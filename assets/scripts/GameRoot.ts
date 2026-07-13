import {
  _decorator,
  Camera,
  Canvas,
  Color,
  Component,
  EventKeyboard,
  Input,
  input,
  KeyCode,
  Label,
  Layers,
  Node,
  ResolutionPolicy,
  resources,
  Sprite,
  SpriteFrame,
  Texture2D,
  tween,
  UITransform,
  Vec3,
  view,
} from 'cc';

const { ccclass } = _decorator;

type ActionName = 'idle' | 'walk' | 'lantern-idle' | 'lantern-walk';

@ccclass('GameRoot')
export class GameRoot extends Component {
  private readonly designWidth = 960;
  private readonly designHeight = 540;
  private readonly characterY = -138;
  private readonly movementSpeed = 150;
  private readonly framesPerSecond = 8;

  private characterNode: Node | null = null;
  private characterSprite: Sprite | null = null;
  private frames: Record<ActionName, SpriteFrame[]> = {
    idle: [],
    walk: [],
    'lantern-idle': [],
    'lantern-walk': [],
  };

  private leftPressed = false;
  private rightPressed = false;
  private lanternEnabled = false;
  private spacePressed = false;
  private direction = 1;
  private frameIndex = 0;
  private frameTime = 0;
  private currentAction: ActionName = 'idle';
  private previewFrames: SpriteFrame[] = [];
  private previewFps = 8;
  private previewLoop = true;
  private previewToken = 0;

  onLoad(): void {
    view.setDesignResolutionSize(this.designWidth, this.designHeight, ResolutionPolicy.SHOW_ALL);
    this.createStage();
    this.registerInput();
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.onPreviewMessage);
      this.postPreviewMessage({ type: 'windup:preview-ready' });
    }
  }

  private createStage(): void {
    const scene = this.node.scene;
    if (!scene) return;

    const canvasNode = new Node('Canvas');
    canvasNode.layer = Layers.Enum.UI_2D;
    scene.addChild(canvasNode);
    canvasNode.addComponent(UITransform).setContentSize(this.designWidth, this.designHeight);
    const canvas = canvasNode.addComponent(Canvas);

    const cameraNode = new Node('UICamera');
    cameraNode.layer = Layers.Enum.UI_2D;
    canvasNode.addChild(cameraNode);
    cameraNode.setPosition(0, 0, 1000);
    const camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.ORTHO;
    camera.orthoHeight = this.designHeight / 2;
    camera.clearColor = new Color(5, 12, 24, 255);
    camera.visibility = Layers.Enum.UI_2D;
    canvas.cameraComponent = camera;

    this.createBackground(canvasNode);
    this.createCharacter(canvasNode);
    this.createInstructions(canvasNode);
  }

  private createBackground(parent: Node): void {
    const backgroundNode = new Node('OldStreet');
    backgroundNode.layer = Layers.Enum.UI_2D;
    parent.addChild(backgroundNode);
    const transform = backgroundNode.addComponent(UITransform);
    transform.setContentSize(this.designWidth, this.designHeight);
    const sprite = backgroundNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    resources.load('background/old-street/spriteFrame', SpriteFrame, (error, frame) => {
      if (error) {
        console.error('Unable to load the old street background.', error);
        return;
      }
      frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
      sprite.spriteFrame = frame;
    });
  }

  private createCharacter(parent: Node): void {
    this.characterNode = new Node('Lamplighter');
    this.characterNode.layer = Layers.Enum.UI_2D;
    parent.addChild(this.characterNode);
    this.characterNode.setPosition(-300, this.characterY, 0);
    this.characterNode.addComponent(UITransform).setContentSize(180, 180);
    this.characterSprite = this.characterNode.addComponent(Sprite);
    this.characterSprite.sizeMode = Sprite.SizeMode.CUSTOM;

    resources.loadDir('character/frames', SpriteFrame, (error, loadedFrames) => {
      if (error) {
        console.error('Unable to load lamplighter animation frames.', error);
        return;
      }

      for (const frame of loadedFrames) {
        frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        const name = frame.name;
        if (name.startsWith('lantern-walk')) this.frames['lantern-walk'].push(frame);
        else if (name.startsWith('walk')) this.frames.walk.push(frame);
        else if (name.startsWith('idle')) this.frames.idle.push(frame);
      }

      for (const action of Object.keys(this.frames) as ActionName[]) {
        this.frames[action].sort((a, b) => a.name.localeCompare(b.name));
      }
      const byName = new Map(loadedFrames.map((frame) => [frame.name, frame]));
      const pick = (...names: string[]) => names
        .map((name) => byName.get(name))
        .filter((frame): frame is SpriteFrame => Boolean(frame));

      // AI sheets are pose collections, not guaranteed animation order.
      // Curate a readable contact/pass/contact/pass cycle and keep idle in the same visual family.
      this.frames.idle = pick('walk-05');
      this.frames.walk = pick(
        'walk-01',
        'walk-02',
        'walk-03',
        'walk-04',
        'walk-05',
        'walk-06',
        'walk-07',
        'walk-08',
      );
      this.frames['lantern-idle'] = pick('lantern-walk-03');
      this.frames['lantern-walk'] = pick(
        'lantern-walk-03',
        'lantern-walk-01',
        'lantern-walk-04',
        'lantern-walk-02',
      );
      this.currentAction = 'idle';
      this.applyFrame();
    });
  }

  private createInstructions(parent: Node): void {
    const instructionNode = new Node('Instructions');
    instructionNode.layer = Layers.Enum.UI_2D;
    parent.addChild(instructionNode);
    instructionNode.setPosition(0, -244, 0);
    instructionNode.addComponent(UITransform).setContentSize(520, 32);
    const label = instructionNode.addComponent(Label);
    label.string = '← → / A D  移动     SPACE  切换提灯';
    label.fontSize = 16;
    label.lineHeight = 22;
    label.color = new Color(226, 214, 184, 210);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
  }

  private registerInput(): void {
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  private onKeyDown(event: EventKeyboard): void {
    if (event.keyCode === KeyCode.ARROW_LEFT || event.keyCode === KeyCode.KEY_A) this.leftPressed = true;
    if (event.keyCode === KeyCode.ARROW_RIGHT || event.keyCode === KeyCode.KEY_D) this.rightPressed = true;
    if (event.keyCode === KeyCode.SPACE && !this.spacePressed) {
      this.spacePressed = true;
      this.lanternEnabled = !this.lanternEnabled;
    }
  }

  private onKeyUp(event: EventKeyboard): void {
    if (event.keyCode === KeyCode.ARROW_LEFT || event.keyCode === KeyCode.KEY_A) this.leftPressed = false;
    if (event.keyCode === KeyCode.ARROW_RIGHT || event.keyCode === KeyCode.KEY_D) this.rightPressed = false;
    if (event.keyCode === KeyCode.SPACE) this.spacePressed = false;
  }

  private onPreviewMessage = (event: MessageEvent): void => {
    const request = event.data as { type?: string; character?: string; action?: string; view?: string; fps?: number; loop?: boolean };
    if (request?.type !== 'windup:preview-animation' || !request.action || !request.view) return;
    const supportedCharacters = ['lamplighter', 'boy', 'skeleton', 'lirael'];
    const character = request.character && supportedCharacters.includes(request.character) ? request.character : 'lamplighter';
    const base = character === 'lamplighter'
      ? request.view === 'side' && request.action === 'walk' ? 'character/frames' : `character/views/${request.view}`
      : `characters/${character}/views/${request.view}`;
    const token = ++this.previewToken;
    if (this.characterNode) tween(this.characterNode).to(0.14, { scale: new Vec3(this.direction * 0.86, 0.86, 1) }).start();
    resources.loadDir(base, SpriteFrame, (error, loadedFrames) => {
      if (token !== this.previewToken) return;
      if (error) {
        this.postPreviewMessage({ type: 'windup:preview-error', reason: String(error) });
        return;
      }
      const matches = loadedFrames
        .filter((frame) => frame.name.startsWith(`${request.action}-`))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!matches.length) {
        this.postPreviewMessage({ type: 'windup:preview-error', reason: '资产未找到' });
        return;
      }
      matches.forEach((frame) => frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST));
      this.previewFrames = matches;
      this.previewFps = 8;
      this.previewLoop = request.loop !== false;
      this.frameIndex = 0;
      this.frameTime = 0;
      this.applyFrame();
      if (this.characterNode) tween(this.characterNode).to(0.22, { scale: new Vec3(this.direction, 1, 1) }).start();
      this.postPreviewMessage({ type: 'windup:preview-applied', character, action: request.action, view: request.view, frames: matches.length });
    });
  };

  private postPreviewMessage(message: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    window.parent?.postMessage(message, '*');
    window.opener?.postMessage(message, '*');
  }

  update(deltaTime: number): void {
    if (!this.characterNode) return;

    if (this.previewFrames.length) {
      this.frameTime += deltaTime;
      if (this.frameTime >= 1 / this.previewFps) {
        this.frameTime %= 1 / this.previewFps;
        if (this.previewLoop || this.frameIndex < this.previewFrames.length - 1) this.frameIndex += 1;
        this.applyFrame();
      }
      return;
    }

    const movement = Number(this.rightPressed) - Number(this.leftPressed);
    if (movement !== 0) {
      this.direction = movement > 0 ? 1 : -1;
      const position = this.characterNode.position;
      const nextX = Math.max(-390, Math.min(390, position.x + movement * this.movementSpeed * deltaTime));
      this.characterNode.setPosition(new Vec3(nextX, this.characterY, 0));
      this.characterNode.setScale(this.direction, 1, 1);
    }

    const nextAction: ActionName = movement === 0
      ? this.lanternEnabled ? 'lantern-idle' : 'idle'
      : this.lanternEnabled ? 'lantern-walk' : 'walk';
    if (nextAction !== this.currentAction) {
      this.currentAction = nextAction;
      this.frameIndex = 0;
      this.frameTime = 0;
      this.applyFrame();
    }

    this.frameTime += deltaTime;
    if (this.frameTime >= 1 / this.framesPerSecond) {
      this.frameTime %= 1 / this.framesPerSecond;
      this.frameIndex += 1;
      this.applyFrame();
    }
  }

  private applyFrame(): void {
    if (!this.characterSprite) return;
    if (this.previewFrames.length) {
      this.characterSprite.spriteFrame = this.previewFrames[this.frameIndex % this.previewFrames.length];
      return;
    }
    const actionFrames = this.frames[this.currentAction];
    if (actionFrames.length === 0) return;
    this.characterSprite.spriteFrame = actionFrames[this.frameIndex % actionFrames.length];
  }

  onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    if (typeof window !== 'undefined') window.removeEventListener('message', this.onPreviewMessage);
  }
}
