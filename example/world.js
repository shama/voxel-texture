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
var container = document.body;
game.appendTo(container);
container.addEventListener('click', function() {
  game.requestPointerLock(container);
});

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
  texturePath: game.texturePath,
  THREE: game.THREE
});

// load materials
materialEngine.load([
  ['0'],
  ['0', '1'],
  ['0', '1', '2'],
  ['0', '1', '2', '3'],
  ['0', '1', '2', '3', '4', '5']/*,
  {
    top:    'grass',
    bottom: 'dirt',
    front:  'grass_dirt',
    back:   'grass_dirt',
    left:   'grass_dirt',
    right:  'grass_dirt'
  }*/
], {
  materialType: game.THREE.MeshPhongShader
});

function createCube(i, material) {
  // create a mesh
  var mesh = new game.THREE.Mesh(
    new game.THREE.CubeGeometry(game.cubeSize, game.cubeSize, game.cubeSize),
    material
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
}

// retrieve loaded textures
for (var i = 0; i < 5; i++) {
  createCube(i, materialEngine.get(i * 6, 6))
}
createCube(i, materialEngine.get('grass', 6));

/*[
  ['0'],
  ['0', '1'],
  ['0', '1', '2'],
  ['0', '1', '2', '3'],
  ['0', '1', '2', '3', '4', '5'],
  [
    '0'.split(''),
    '11'.split(''),
    '222'.split(''),
    '3333'.split(''),
    '44444'.split(''),
    '555555'.split('')
  ],
  {
    top:    'grass',
    bottom: 'dirt',
    front:  'grass_dirt',
    back:   'grass_dirt',
    left:   'grass_dirt',
    right:  'grass_dirt'
  }
].forEach(function(materials, i) {
  // load materials
  materials = materialEngine.load([materials], {
    materialParams: { color: (Math.random() * 0xffffff)|0 },
    materialType: game.THREE.MeshPhongShader
  });
  console.log(materials);

  // Create a mesh
  var mesh = new game.THREE.Mesh(
    new game.THREE.CubeGeometry(game.cubeSize, game.cubeSize, game.cubeSize),
    new game.THREE.MeshFaceMaterial(materials)
  );
  mesh.translateX(0);
  mesh.translateY(250);
  mesh.translateZ(-(i * 80) + 200);

  // Create a rotating jumping cube
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
});*/


// load a sprite
/*materialEngine.sprite('terrain', 32, function(err, textures) {

  var mesh = new game.THREE.Mesh(
    new game.THREE.CubeGeometry(game.cubeSize, game.cubeSize, game.cubeSize),
    materialEngine.load(textures)
  );
  mesh.translateX(250);
  mesh.translateY(250);
  mesh.translateZ(250);

  var cube = {
    mesh: mesh,
    width: game.cubeSize, height: game.cubeSize, depth: game.cubeSize,
    collisionRadius: game.cubeSize
  };
  cube.tick = function() { cube.mesh.rotation.y += Math.PI / 180; };
  setInterval(function() {
    cube.velocity.y += 0.15;
    cube.resting = false;
  }, 2000);
  game.addItem(cube);
});
*/





