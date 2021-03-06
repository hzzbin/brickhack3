/**
 * Class encapsulating the client side of the game, handles drawing and
 * updates.
 * @author alvin.lin.dev@gmail.com (Alvin Lin)
 */

/**
 * Creates a game on the client side to manage and render the game.
 * @constructor
 */
function Game(socket, drawing, sound, viewport) {
  this.socket = socket;

  this.drawing = drawing;
  this.sound = sound;
  this.viewport = viewport;

  this.self = null;

  /**
   * @type {Array<Object>}
   */
  this.players = [];

  /**
   * @type {Array<Object>}
   */
  this.explosions = [];
  this.leaderboard = [];

  this.animationFrameId = 0;
}

/**
 * Factory method for the Game class.
 * @param {Object} socket The socket connected to the server.
 * @param {Element} canvasElement The HTML5 canvas to render the game on.
 * @return {Game}
 */
Game.create = function(socket, canvasElement) {
  canvasElement.width = Constants.CANVAS_WIDTH;
  canvasElement.height = Constants.CANVAS_HEIGHT;
  var canvasContext = canvasElement.getContext('2d');

  var drawing = Drawing.create(canvasContext);
  var sound = Sound.create();
  var viewport = Viewport.create();

  var game = new Game(socket, drawing, sound, viewport);
  game.init();
  return game;
};

/**
 * Initializes the game and sets the event handler for the server packets.
 */
Game.prototype.init = function() {
  this.socket.on('update', bind(this, function(data) {
    this.receiveGameState(data);
  }));
  this.socket.on('toast', function(message) {
    Materialize.toast(message, 2500);
  });
  this.socket.on('sound', bind(this, function(data) {
    this.sound.play(data.sound, data.volume);
  }));

};

/**
 * Updates the game's internal storage of all the powerups, called each time
 * the server sends packets.
 * @param {Object} state An object containing the state of the game sent by
 *   the server.
 */
Game.prototype.receiveGameState = function(state) {
  this.self = state['self'];
  this.players = state['players'];
  this.bombs = state['bombs'];
  this.explosions = state['explosions'];
  this.leaderboard = state['leaderboard'];
};

/**
 * This method begins the animation loop for the game.
 */
Game.prototype.animate = function() {
  this.animationFrameId = window.requestAnimationFrame(
      bind(this, this.run));
};

/**
 * This method stops the animation loop for the game.
 */
Game.prototype.stopAnimation = function() {
  window.cancelAnimationFrame(this.animationFrameId);
};

/**
 * This method is a convenience method that calls update and draw.
 */
Game.prototype.run = function() {
  this.update();
  this.draw();
  this.animate();
};

/**
 * Updates the state of the game client side and relays intents to the
 * server.
 */
Game.prototype.update = function() {
  if (this.self) {
    this.viewport.update(this.self['x'], this.self['y']);
    var packet = {
      keyboardState: {
        up: Input.UP,
        right: Input.RIGHT,
        down: Input.DOWN,
        left: Input.LEFT,
        longerFuse: Input.MISC_KEYS[69],
        shorterFuse: Input.MISC_KEYS[81]
      },
      mouse: this.viewport.toWorldCoords.apply(this.viewport, Input.MOUSE),
      click: Input.LEFT_CLICK,
      timestamp: (new Date()).getTime()
    };
    this.socket.emit('player-action', packet);
  }
};

/**
 * Draws the state of the game onto the HTML5 canvas.
 */
Game.prototype.draw = function() {
  if (this.self) {
    // Clear the canvas.
    this.drawing.clear();

    /**
     * Draw the background first behind the other entities, we calculate the
     * closest top-left coordinate outside of the ViewPort. We use that
     * coordinate to draw background tiles from left to right, top to bottom,
     * so that the entire ViewPort is appropriately filled.
     */
    var center = this.viewport.selfCoords;
    var leftX = this.self['x'] - Constants.CANVAS_WIDTH / 2;
    var topY = this.self['y'] - Constants.CANVAS_HEIGHT / 2;
    var drawStartX = Math.max(
        leftX - (leftX % Drawing.TILE_SIZE), Constants.WORLD_MIN);
    var drawStartY = Math.max(
        topY - (topY % Drawing.TILE_SIZE), Constants.WORLD_MIN);
    /**
     * drawEndX and drawEndY have an extra Drawing.TILE_SIZE added to account
     * for the edge case where we are at the bottom rightmost part of the
     * world.
     */
    var drawEndX = Math.min(
        drawStartX + Constants.CANVAS_WIDTH + Drawing.TILE_SIZE,
        Constants.WORLD_MAX);
    var drawEndY = Math.min(
        drawStartY + Constants.CANVAS_HEIGHT + Drawing.TILE_SIZE,
        Constants.WORLD_MAX);
    this.drawing.drawTiles(
        this.viewport.toCanvasX(drawStartX),
        this.viewport.toCanvasY(drawStartY),
        this.viewport.toCanvasX(drawEndX),
        this.viewport.toCanvasY(drawEndY)
    );
    for (var bomb of this.bombs) {
      this.drawing.drawBomb(
          this.viewport.toCanvasX(bomb['x']),
          this.viewport.toCanvasY(bomb['y']),
          bomb['size'],
          bomb['fuse']
      );
    }
    if (this.self) {
      this.drawing.drawPlayer(
          true,
          this.self['name'],
          this.viewport.toCanvasX(this.self['x']),
          this.viewport.toCanvasY(this.self['y']),
          this.self['size'],
          this.self['orientation'],
          this.self['health'],
          this.self['bombFuse']
      );
    }
    for (var player of this.players) {
      this.drawing.drawPlayer(
          false,
          player['name'],
          this.viewport.toCanvasX(player['x']),
          this.viewport.toCanvasY(player['y']),
          player['size'],
          player['orientation'],
          player['health'],
          player['bombFuse']
      );
    }
    for (var explosion of this.explosions) {
      this.drawing.drawExplosion(
          this.viewport.toCanvasX(explosion['x']),
          this.viewport.toCanvasY(explosion['y']),
          explosion['size'],
          explosion['frame']
      )
    }
    this.drawing.drawLeaderboard(this.leaderboard);
  }
};
