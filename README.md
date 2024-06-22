# ImageMapTiles
Node Module to convert large Images into tiles for use with JS map rendering libraries.

## Installation
npm i image-map-tiles -S

## Usage

```
const imageMapTiles = require('image-map-tiles');

var options = {
	'outputDir': 'path/to/output',
	'zoom': 5,
	'tileHeight': 256,
	'tileWidth': 256
}

imageMapTiles('path/to/image', options );
```

## Implementing Tiles
https://developers.google.com/maps/documentation/javascript/examples/maptype-image