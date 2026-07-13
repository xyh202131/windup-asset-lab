System.register("chunks:///_virtual/GameRoot.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _inheritsLoose, _createForOfIteratorHelperLoose, cclegacy, _decorator, view, ResolutionPolicy, Node, Layers, UITransform, Canvas, Camera, Color, Sprite, resources, SpriteFrame, Texture2D, Label, input, Input, KeyCode, Vec3, tween, Component;
  return {
    setters: [function (module) {
      _inheritsLoose = module.inheritsLoose;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      view = module.view;
      ResolutionPolicy = module.ResolutionPolicy;
      Node = module.Node;
      Layers = module.Layers;
      UITransform = module.UITransform;
      Canvas = module.Canvas;
      Camera = module.Camera;
      Color = module.Color;
      Sprite = module.Sprite;
      resources = module.resources;
      SpriteFrame = module.SpriteFrame;
      Texture2D = module.Texture2D;
      Label = module.Label;
      input = module.input;
      Input = module.Input;
      KeyCode = module.KeyCode;
      Vec3 = module.Vec3;
      tween = module.tween;
      Component = module.Component;
    }],
    execute: function () {
      var _dec, _class;
      cclegacy._RF.push({}, "98dcdQl8GhEYLJRG8ap+Eh+", "GameRoot", undefined);
      var ccclass = _decorator.ccclass;
      var GameRoot = exports('GameRoot', (_dec = ccclass('GameRoot'), _dec(_class = /*#__PURE__*/function (_Component) {
        _inheritsLoose(GameRoot, _Component);
        function GameRoot() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _this.designWidth = 960;
          _this.designHeight = 540;
          _this.characterY = -138;
          _this.movementSpeed = 150;
          _this.framesPerSecond = 8;
          _this.characterNode = null;
          _this.characterSprite = null;
          _this.frames = {
            idle: [],
            walk: [],
            'lantern-idle': [],
            'lantern-walk': []
          };
          _this.leftPressed = false;
          _this.rightPressed = false;
          _this.lanternEnabled = false;
          _this.spacePressed = false;
          _this.direction = 1;
          _this.frameIndex = 0;
          _this.frameTime = 0;
          _this.currentAction = 'idle';
          _this.previewFrames = [];
          _this.previewFps = 8;
          _this.previewLoop = true;
          _this.previewToken = 0;
          _this.onPreviewMessage = function (event) {
            var request = event.data;
            if ((request == null ? void 0 : request.type) !== 'windup:preview-animation' || !request.action || !request.view) return;
            var supportedCharacters = ['lamplighter', 'boy', 'skeleton', 'lirael'];
            var character = request.character && supportedCharacters.includes(request.character) ? request.character : 'lamplighter';
            var base = character === 'lamplighter' ? request.view === 'side' && request.action === 'walk' ? 'character/frames' : "character/views/" + request.view : "characters/" + character + "/views/" + request.view;
            var token = ++_this.previewToken;
            if (_this.characterNode) tween(_this.characterNode).to(0.14, {
              scale: new Vec3(_this.direction * 0.86, 0.86, 1)
            }).start();
            resources.loadDir(base, SpriteFrame, function (error, loadedFrames) {
              if (token !== _this.previewToken) return;
              if (error) {
                _this.postPreviewMessage({
                  type: 'windup:preview-error',
                  reason: String(error)
                });
                return;
              }
              var matches = loadedFrames.filter(function (frame) {
                return frame.name.startsWith(request.action + "-");
              }).sort(function (a, b) {
                return a.name.localeCompare(b.name);
              });
              if (!matches.length) {
                _this.postPreviewMessage({
                  type: 'windup:preview-error',
                  reason: '资产未找到'
                });
                return;
              }
              matches.forEach(function (frame) {
                return frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
              });
              _this.previewFrames = matches;
              _this.previewFps = 8;
              _this.previewLoop = request.loop !== false;
              _this.frameIndex = 0;
              _this.frameTime = 0;
              _this.applyFrame();
              if (_this.characterNode) tween(_this.characterNode).to(0.22, {
                scale: new Vec3(_this.direction, 1, 1)
              }).start();
              _this.postPreviewMessage({
                type: 'windup:preview-applied',
                character: character,
                action: request.action,
                view: request.view,
                frames: matches.length
              });
            });
          };
          return _this;
        }
        var _proto = GameRoot.prototype;
        _proto.onLoad = function onLoad() {
          view.setDesignResolutionSize(this.designWidth, this.designHeight, ResolutionPolicy.SHOW_ALL);
          this.createStage();
          this.registerInput();
          if (typeof window !== 'undefined') {
            window.addEventListener('message', this.onPreviewMessage);
            this.postPreviewMessage({
              type: 'windup:preview-ready'
            });
          }
        };
        _proto.createStage = function createStage() {
          var scene = this.node.scene;
          if (!scene) return;
          var canvasNode = new Node('Canvas');
          canvasNode.layer = Layers.Enum.UI_2D;
          scene.addChild(canvasNode);
          canvasNode.addComponent(UITransform).setContentSize(this.designWidth, this.designHeight);
          var canvas = canvasNode.addComponent(Canvas);
          var cameraNode = new Node('UICamera');
          cameraNode.layer = Layers.Enum.UI_2D;
          canvasNode.addChild(cameraNode);
          cameraNode.setPosition(0, 0, 1000);
          var camera = cameraNode.addComponent(Camera);
          camera.projection = Camera.ProjectionType.ORTHO;
          camera.orthoHeight = this.designHeight / 2;
          camera.clearColor = new Color(5, 12, 24, 255);
          camera.visibility = Layers.Enum.UI_2D;
          canvas.cameraComponent = camera;
          this.createBackground(canvasNode);
          this.createCharacter(canvasNode);
          this.createInstructions(canvasNode);
        };
        _proto.createBackground = function createBackground(parent) {
          var backgroundNode = new Node('OldStreet');
          backgroundNode.layer = Layers.Enum.UI_2D;
          parent.addChild(backgroundNode);
          var transform = backgroundNode.addComponent(UITransform);
          transform.setContentSize(this.designWidth, this.designHeight);
          var sprite = backgroundNode.addComponent(Sprite);
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          resources.load('background/old-street/spriteFrame', SpriteFrame, function (error, frame) {
            if (error) {
              console.error('Unable to load the old street background.', error);
              return;
            }
            frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
            sprite.spriteFrame = frame;
          });
        };
        _proto.createCharacter = function createCharacter(parent) {
          var _this2 = this;
          this.characterNode = new Node('Lamplighter');
          this.characterNode.layer = Layers.Enum.UI_2D;
          parent.addChild(this.characterNode);
          this.characterNode.setPosition(-300, this.characterY, 0);
          this.characterNode.addComponent(UITransform).setContentSize(180, 180);
          this.characterSprite = this.characterNode.addComponent(Sprite);
          this.characterSprite.sizeMode = Sprite.SizeMode.CUSTOM;
          resources.loadDir('character/frames', SpriteFrame, function (error, loadedFrames) {
            if (error) {
              console.error('Unable to load lamplighter animation frames.', error);
              return;
            }
            for (var _iterator = _createForOfIteratorHelperLoose(loadedFrames), _step; !(_step = _iterator()).done;) {
              var frame = _step.value;
              frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
              var name = frame.name;
              if (name.startsWith('lantern-walk')) _this2.frames['lantern-walk'].push(frame);else if (name.startsWith('walk')) _this2.frames.walk.push(frame);else if (name.startsWith('idle')) _this2.frames.idle.push(frame);
            }
            for (var _i = 0, _arr = Object.keys(_this2.frames); _i < _arr.length; _i++) {
              var action = _arr[_i];
              _this2.frames[action].sort(function (a, b) {
                return a.name.localeCompare(b.name);
              });
            }
            var byName = new Map(loadedFrames.map(function (frame) {
              return [frame.name, frame];
            }));
            var pick = function pick() {
              for (var _len2 = arguments.length, names = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                names[_key2] = arguments[_key2];
              }
              return names.map(function (name) {
                return byName.get(name);
              }).filter(function (frame) {
                return Boolean(frame);
              });
            };

            // AI sheets are pose collections, not guaranteed animation order.
            // Curate a readable contact/pass/contact/pass cycle and keep idle in the same visual family.
            _this2.frames.idle = pick('walk-05');
            _this2.frames.walk = pick('walk-01', 'walk-02', 'walk-03', 'walk-04', 'walk-05', 'walk-06', 'walk-07', 'walk-08');
            _this2.frames['lantern-idle'] = pick('lantern-walk-03');
            _this2.frames['lantern-walk'] = pick('lantern-walk-03', 'lantern-walk-01', 'lantern-walk-04', 'lantern-walk-02');
            _this2.currentAction = 'idle';
            _this2.applyFrame();
          });
        };
        _proto.createInstructions = function createInstructions(parent) {
          var instructionNode = new Node('Instructions');
          instructionNode.layer = Layers.Enum.UI_2D;
          parent.addChild(instructionNode);
          instructionNode.setPosition(0, -244, 0);
          instructionNode.addComponent(UITransform).setContentSize(520, 32);
          var label = instructionNode.addComponent(Label);
          label.string = '← → / A D  移动     SPACE  切换提灯';
          label.fontSize = 16;
          label.lineHeight = 22;
          label.color = new Color(226, 214, 184, 210);
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
        };
        _proto.registerInput = function registerInput() {
          input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
          input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        };
        _proto.onKeyDown = function onKeyDown(event) {
          if (event.keyCode === KeyCode.ARROW_LEFT || event.keyCode === KeyCode.KEY_A) this.leftPressed = true;
          if (event.keyCode === KeyCode.ARROW_RIGHT || event.keyCode === KeyCode.KEY_D) this.rightPressed = true;
          if (event.keyCode === KeyCode.SPACE && !this.spacePressed) {
            this.spacePressed = true;
            this.lanternEnabled = !this.lanternEnabled;
          }
        };
        _proto.onKeyUp = function onKeyUp(event) {
          if (event.keyCode === KeyCode.ARROW_LEFT || event.keyCode === KeyCode.KEY_A) this.leftPressed = false;
          if (event.keyCode === KeyCode.ARROW_RIGHT || event.keyCode === KeyCode.KEY_D) this.rightPressed = false;
          if (event.keyCode === KeyCode.SPACE) this.spacePressed = false;
        };
        _proto.postPreviewMessage = function postPreviewMessage(message) {
          var _window$parent, _window$opener;
          if (typeof window === 'undefined') return;
          (_window$parent = window.parent) == null || _window$parent.postMessage(message, '*');
          (_window$opener = window.opener) == null || _window$opener.postMessage(message, '*');
        };
        _proto.update = function update(deltaTime) {
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
          var movement = Number(this.rightPressed) - Number(this.leftPressed);
          if (movement !== 0) {
            this.direction = movement > 0 ? 1 : -1;
            var position = this.characterNode.position;
            var nextX = Math.max(-390, Math.min(390, position.x + movement * this.movementSpeed * deltaTime));
            this.characterNode.setPosition(new Vec3(nextX, this.characterY, 0));
            this.characterNode.setScale(this.direction, 1, 1);
          }
          var nextAction = movement === 0 ? this.lanternEnabled ? 'lantern-idle' : 'idle' : this.lanternEnabled ? 'lantern-walk' : 'walk';
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
        };
        _proto.applyFrame = function applyFrame() {
          if (!this.characterSprite) return;
          if (this.previewFrames.length) {
            this.characterSprite.spriteFrame = this.previewFrames[this.frameIndex % this.previewFrames.length];
            return;
          }
          var actionFrames = this.frames[this.currentAction];
          if (actionFrames.length === 0) return;
          this.characterSprite.spriteFrame = actionFrames[this.frameIndex % actionFrames.length];
        };
        _proto.onDestroy = function onDestroy() {
          input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
          input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
          if (typeof window !== 'undefined') window.removeEventListener('message', this.onPreviewMessage);
        };
        return GameRoot;
      }(Component)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/main", ['./GameRoot.ts'], function () {
  return {
    setters: [null],
    execute: function () {}
  };
});

(function(r) {
  r('virtual:///prerequisite-imports/main', 'chunks:///_virtual/main'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});