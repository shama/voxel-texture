# voxel-texture

> A texture helper for [voxeljs](http://voxeljs.com).

View [the demo](https://shama.github.com/voxel-texture).

## example
```js
// Pass it a copy of the game
var createMaterials = require('voxel-texture')(game);

// Create 6 sided material, all sides same texture
var materials = createMaterials('grass');
```

This will load `'./textures/grass.png'` assuming your
`game.texturePath === './textures/'`.

Then you can use the materials like such:
```js
var cube = new game.THREE.Mesh(
  new game.THREE.CubeGeometry(game.cubeSize, game.cubeSize, game.cubeSize),
  materials
);
```

OR specify each side of the material:
```js
var materials = createMaterials([
  'grass',      // BACK
  'dirt',       // FRONT
  'brick',      // TOP
  'bedrock',    // BOTTOM
  'glowstone',  // LEFT
  'obsidian'    // RIGHT
]);
```

OR just the top and sides:
```js
var materials = createMaterials([
  'grass',      // TOP/BOTTOM
  'grass_dirt', // SIDES
]);
```

OR the top, bottom and sides:
```js
var materials = createMaterials([
  'grass',      // TOP
  'dirt',       // BOTTOM
  'grass_dirt', // SIDES
]);
```

OR the top, bottom, front/back and left/right:
```js
var materials = createMaterials([
  'grass',      // TOP
  'dirt',       // BOTTOM
  'grass_dirt', // FRONT/BACK
  'brick',      // LEFT/RIGHT
]);
```

OR if your memory sucks like mine:
```js
var materials = createMaterials({
  top:    'grass',
  bottom: 'dirt',
  left:   'grass_dirt',
  right:  'grass_dirt',
  front:  'grass_dirt',
  back:   'grass_dirt'
});
```
_Just be sure to include all the keys_

### Alternate File Extension

If your texture isn't a `.png`, just specify the extension:
```js
var materials = createMaterials([
  'diamond',
  'crate.gif',
]);
```

## install
With [npm](http://npmjs.org) do:

```
npm install voxel-texture
```

## release history
* 0.1.0 - initial release

## license
Copyright (c) 2013 Kyle Robinson Young  
Licensed under the MIT license.
