import { mkdirp } from "mkdirp";
import sharp from "sharp";

export type Options = {
  outputDir: string;
  zoom: number;
  tileHeight: number;
  tileWidth: number;
};

type Task = {
  outputDir: string;
  scale: number;
};

let image: sharp.Sharp;
let metadata: sharp.Metadata;

export const imageMapTiles = async (imagePath: string, options: Options) => {
  image = sharp(imagePath);
  metadata = await image.metadata();

  const tasks: Task[] = await buildTasks(options);

  await execTasks(options, tasks);

  console.log();
  console.log("done processTasks");
};

const buildTasks = async (options: Options) => {
  let updatedTasks: Task[] = [];
  let scale = 1.0;
  let zoom_name = 20;
  let zoomCount = options.zoom;
  updatedTasks.push({
    outputDir: options.outputDir + "/" + zoomCount,
    scale: scale,
  });
  console.log("before DO - ZOOM", zoomCount);
  zoomCount = zoomCount - 1;
  for (let i = 0; i < options.zoom; i++) {
    scale = scale / 2.0;
    zoom_name = zoom_name - 1;
    updatedTasks.push({
      outputDir: options.outputDir + "/" + zoomCount,
      scale: scale,
    });
    zoomCount = zoomCount - 1;
    console.log("zoomCount", zoomCount);
  }
  console.log(updatedTasks);

  return updatedTasks;
};

const execTasks = async (options: Options, tasks: Task[]) => {
  await tasks.reduce(async (promiseChain, task: Task, i: number) => {
    await promiseChain;
    await executeTask(options, task, i);
    return task;
  }, Promise.resolve({}));
};

const executeTask = async (options: Options, task: Task, i: number) => {
  return new Promise<void>(async (resolve, _reject) => {
    console.log("executeTask", i);

    try {
      await mkdirp(task.outputDir);
    } catch (err) {
      console.error("mkdirp error", err);
    }

    const taskImage = image;

    console.log("--------------------------");
    console.log("task", task, i);

    if (task.scale != 1.0) {
      const scaleData = {
        width: Math.floor(metadata.width! * task.scale),
        height: Math.floor(metadata.height! * task.scale),
      };
      console.log("imageSize" + i + ":", scaleData);
      const extendOptions = {
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
      };

      const tileWidthIntoImage = scaleData.width / options.tileWidth;
      // 5.46875 = 1400 / 256
      console.log("tileWidthIntoImage : 5.46875", tileWidthIntoImage);
      const tileHeightIntoImage = scaleData.height / options.tileHeight;
      // 1.84375 = 472 / 256

      if (tileWidthIntoImage % 1 != 0) {
        const percentToFullTile =
          Math.ceil(tileWidthIntoImage) - tileWidthIntoImage;
        // 0.53125 = 6 - 5.46875
        console.log("percentToFullTile 0.53125 : ", percentToFullTile);
        const pixelsToAdd = percentToFullTile * options.tileWidth;
        // 26.352941176 = 0.53125 * 256
        extendOptions.right = Math.ceil(pixelsToAdd);
        // 27
        console.log("pixelsToAdd 27", pixelsToAdd);
      }

      if (tileHeightIntoImage % 1 != 0) {
        const percentToFullTile =
          Math.ceil(tileHeightIntoImage) - tileHeightIntoImage;
        const pixelsToAdd = percentToFullTile * options.tileHeight;
        extendOptions.bottom = Math.ceil(pixelsToAdd);
      }

      console.log("extendOptions", extendOptions);

      taskImage
        .resize(scaleData.width, scaleData.height)
        .extend(extendOptions)
        .toBuffer(async (_err, buffer, info) => {
          await makeTiles(
            options,
            buffer,
            info,
            task.outputDir,
            options.tileWidth,
            options.tileHeight,
          );
          resolve();
        });
    } else {
      const extendOptions = {
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
      };
      const tileWidthIntoImage = metadata.width! / options.tileWidth;
      // 5.46875 = 1400 / 256
      console.log("tileWidthIntoImage : 5.46875", tileWidthIntoImage);
      const tileHeightIntoImage = metadata.height! / options.tileHeight;
      // 1.84375 = 472 / 256

      if (tileWidthIntoImage % 1 != 0) {
        const percentToFullTile =
          Math.ceil(tileWidthIntoImage) - tileWidthIntoImage;
        // 0.53125 = 6 - 5.46875
        console.log("percentToFullTile 0.53125 : ", percentToFullTile);
        const pixelsToAdd = percentToFullTile * options.tileWidth;
        // 26.352941176 = 0.53125 * 256
        extendOptions.right = Math.ceil(pixelsToAdd);
        // 27
        console.log("pixelsToAdd 27", pixelsToAdd);
      }

      if (tileHeightIntoImage % 1 != 0) {
        const percentToFullTile =
          Math.ceil(tileHeightIntoImage) - tileHeightIntoImage;
        const pixelsToAdd = percentToFullTile * options.tileHeight;
        extendOptions.bottom = Math.ceil(pixelsToAdd);
      }

      console.log("extendOptions: ", extendOptions);
      taskImage.extend(extendOptions).toBuffer(async (_err, buffer, info) => {
        await makeTiles(
          options,
          buffer,
          info,
          task.outputDir,
          options.tileWidth,
          options.tileHeight,
        );
        resolve();
      });
    }
  });
};

const makeTiles = (
  options: Options,
  buffer: Buffer,
  metadata: sharp.OutputInfo,
  zoomPath: string,
  tileWidth: number,
  tileHeight: number,
) => {
  return new Promise<void>(async (resolve, _reject) => {
    console.log();
    // find image width and height
    // then find out how many tiles we'll get out of
    // the image, then use that for the xy offset in crop.
    console.log(zoomPath, tileWidth, tileHeight);
    console.log(metadata.width, metadata.height);

    const num_columns = Math.ceil(metadata.width / tileWidth);
    const num_rows = Math.ceil(metadata.height / tileHeight);

    console.log(
      "Tiling image into: " + num_columns + "columns, " + num_rows + "rows",
    );

    let x = 0;
    let y = 0;
    let row = 0;
    let column = 0;
    const crops = [];

    while (true) {
      x = column * tileWidth;
      y = row * tileHeight;

      const crop = {
        x: x,
        y: y,
        row: row,
        column: column,
      };
      // console.log(crop);
      crops.push(crop);

      column = column + 1;
      // console.log('column >= num_columns', column, num_columns);
      if (column >= num_columns) {
        column = 0;
        row = row + 1;
      }
      // console.log('row >= num_rows', row, num_rows);
      if (row >= num_rows) {
        break;
      }
    }
    // console.log('crops', crops);

    await crops.reduce(async (promiseChain, crop) => {
      await promiseChain;
      const tilePath = zoomPath + "/" + crop.column + "/";
      const imageBuffer = sharp(buffer);
      await exportImage(imageBuffer, options, tilePath, crop);
      return crop;
    }, Promise.resolve({}));

    console.log("processCrops done");
    resolve();
  });
};

const exportImage = (
  imageBuffer: sharp.Sharp,
  options: Options,
  tilePath: string,
  crop: { x: number; y: number; row: number; column: number },
) => {
  return new Promise<void>(async (resolve, _reject) => {
    try {
      await mkdirp(tilePath);
      imageBuffer
        .extract({
          left: crop.x,
          top: crop.y,
          width: options.tileWidth,
          height: options.tileHeight,
        })
        .toFile(tilePath + crop.row + ".jpg", (err) => {
          if (err) {
            console.log(crop.row + "-" + crop.column + " :Error", err);
            console.log({
              left: crop.x,
              top: crop.y,
              width: options.tileWidth,
              height: options.tileHeight,
            });
          } else {
            console.log(crop.row + "-" + crop.column + " :Success");
          }
          resolve();
        });
    } catch (err) {
      console.error("mkdirp error", err);
    }
  });
};
