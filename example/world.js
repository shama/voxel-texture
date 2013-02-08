var createEngine = require('voxel-engine');
var game = createEngine({
  generate: function(x, y, z) {
    return (Math.sqrt(x*x + y*y + z*z) > 20 || y*y > 10) ? 0 : (Math.random() * 3) + 1;
  },
  materials: ['brick', ['grass', 'dirt', 'grass_dirt']],
  texturePath: './textures/',
  startingPosition: [200, 200, 0],
  worldOrigin: [0, 0, 0]
});
var container = document.getElementById('container');
game.appendTo(container);
container.addEventListener('click', function() {
  game.requestPointerLock(container);
});

// Give console access to game
window.game = game;

var explode = require('voxel-debris')(game, { power : 1.5 });

explode.on('collect', function (item) {
  console.log(game.materials[item.value - 1]);
});

game.on('mousedown', function (pos) {
  if (erase) explode(pos);
  else game.createBlock(pos, 1);
});

window.addEventListener('keydown', ctrlToggle);
window.addEventListener('keyup', ctrlToggle);

var erase = true;
function ctrlToggle (ev) { erase = !ev.ctrlKey }

// Our texture builder
var materialEngine = require('../')({
  texturePath: './textures/',
  THREE: game.THREE
});

game.on('tick', function(dt) {
  materialEngine.tick(dt);
});

// load materials
materialEngine.load([
  ['0'],
  ['0', '1'],
  ['0', '1', '2'],
  ['0', '1', '2', '3'],
  ['0', '1', '2', '3', '4', '5'],
  {
    top:    'grass',
    bottom: 'dirt',
    front:  'grass_dirt',
    back:   'grass_dirt',
    left:   'grass_dirt',
    right:  'grass_dirt'
  }
], {
  materialType: game.THREE.MeshPhongShader
});

function createCube(i, materials) {
  // set a random color
  materials.forEach(function(material) {
    material.color = new game.THREE.Color((Math.random() * 0xffffff)|0);
    // ensure color is reflected in ambient light as well
    material.ambient = material.color;
  });

  // create a mesh
  var mesh = new game.THREE.Mesh(
    new game.THREE.CubeGeometry(game.cubeSize, game.cubeSize, game.cubeSize),
    new game.THREE.MeshFaceMaterial(materials)
  );
  mesh.translateX(0);
  mesh.translateY(250);
  mesh.translateZ(-(i * 80) + 200);

  // create a rotating jumping cube
  var cube = {
    mesh: mesh,
    width: game.cubeSize, height: game.cubeSize, depth: game.cubeSize,
    collisionRadius: game.cubeSize
  };
  cube.tick = function() { cube.mesh.rotation.y += Math.PI / 180; };
  setInterval(function() {
    cube.velocity.y += 0.15;
    cube.resting = false;
  }, (i * 200) + 2000);

  game.addItem(cube);
  return cube;
}

// retrieve loaded textures
for (var i = 0; i < 5; i++) createCube(i, materialEngine.get(i));
createCube(i++, materialEngine.get('grass'));

// load a sprite map
materialEngine.sprite('terrain', 32, function(err, textures) {
  // load textures into materials
  var materials = materialEngine.load(textures);

  // create cubes randomly textured from the sprite map
  for (var x = 0; x < 6; x++) {
    var r = Math.floor(Math.random() * (materials.length - 5));
    var m = materials.slice(r, r + 6);
    var cube = createCube(x, m);
    cube.mesh.translateX(100);
  }

  // create animated materials
  var stuff = [];
  for (var x = 0; x < materialEngine.materials.length; x++) { stuff.push(x); }
  var disco = materialEngine.animate(stuff, 100);
  disco.transparent = true;
  var discoCube = createCube(3, [disco, disco, disco, disco, disco, disco]);
  discoCube.mesh.translateX(200);

  var breaking = materialEngine.animate([
    'terrain_0_480', 'terrain_32_480', 'terrain_64_480',
    'terrain_96_480', 'terrain_128_480', 'terrain_160_480',
    'terrain_192_480', 'terrain_224_480', 'terrain_256_480',
  ], 1000);
  var breakingCube = createCube(4, [breaking, breaking, breaking, breaking, breaking, breaking]);
  breakingCube.mesh.translateX(200);

  var torch = materialEngine.animate(['terrain_96_192', 'terrain_96_224'], 500);
  var blank = new game.THREE.MeshLambertMaterial({transparent:true,opacity:0});
  var torchCube = createCube(5, [torch, torch, blank, blank, torch, torch]);
  torchCube.mesh.translateX(200);
});
