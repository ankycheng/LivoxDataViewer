const dgram = require("dgram");
const server = dgram.createSocket("udp4");
const socketio = require("socket.io");

const PORT = 56301;
const HOST = "192.168.1.50";

server.on("error", (err) => {
  console.log(`server error:\n${err.stack}`);
  server.close();
});

server.on("message", (msg, rinfo) => {
  parseLivoxLidarPacket(msg);
});

server.on("listening", () => {
  const address = server.address();
  console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(PORT, HOST);

const io = socketio(3000, {
  cors: {
    origin: "*",
  },
}); // 使用Socket.io来传输数据到客户端

function parseLivoxLidarPacket(buffer) {
  const packet = {
    version: buffer.readUInt8(0),
    length: buffer.readUInt16LE(1),
    timeInterval: buffer.readUInt16LE(3),
    dotNum: buffer.readUInt16LE(5),
    udpCnt: buffer.readUInt16LE(7),
    frameCnt: buffer.readUInt8(9),
    dataType: buffer.readUInt8(10),
    timeType: buffer.readUInt8(11),
    timestamp: buffer.readBigUInt64LE(24),
    data: buffer.slice(36),
  };

  // console.log(packet.dataType);
  // Process the point cloud data based on the data type
  if (packet.dataType === 1) {
    processCartesianHighData(packet.data, packet.dotNum);
  } else if (packet.dataType === 2) {
    processCartesianLowData(packet.data, packet.dotNum);
  } else if (packet.dataType === 3) {
    processSphericalData(packet.data, packet.dotNum);
  }
}

function processCartesianHighData(data, dotNum) {
  const points = [];
  for (let i = 0; i < dotNum; i++) {
    let x = data.readInt32LE(i * 14);
    let y = data.readInt32LE(i * 14 + 4);
    let z = data.readInt32LE(i * 14 + 8);

    points[i * 3] = x;
    points[i * 3 + 1] = y;
    points[i * 3 + 2] = z;
  }
  const pointsArray = new Float32Array(points);
  io.emit("points", pointsArray.buffer); // 发送二进制数据到客户端
}

function processCartesianLowData(data, dotNum) {
  const points = new Float32Array(dotNum * 3);
  for (let i = 0; i < dotNum; i++) {
    points[i * 3] = data.readInt16LE(i * 8) * 5;
    points[i * 3 + 1] = data.readInt16LE(i * 8 + 2) * 5;
    points[i * 3 + 2] = data.readInt16LE(i * 8 + 4) * 5;
    // console.log(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
  }
  io.emit("points", points.buffer);
}

function processSphericalData(data, dotNum) {
  const points = new Float32Array(dotNum * 3);
  for (let i = 0; i < dotNum; i++) {
    // 这里需要将球面坐标转换为笛卡尔坐标
    const depth = data.readUInt32LE(i * 9);
    const theta = data.readUInt16LE(i * 9 + 4);
    const phi = data.readUInt16LE(i * 9 + 6);
    points[i * 3] = depth * Math.sin(theta) * Math.cos(phi);
    points[i * 3 + 1] = depth * Math.sin(theta) * Math.sin(phi);
    points[i * 3 + 2] = depth * Math.cos(theta);
  }
  io.emit("points", points.buffer); // 发送二进制数据到客户端
}

// 預先分配記憶體
// const MAX_POINTS = 96;
// const pointsBuffer = new ArrayBuffer(MAX_POINTS * 3 * 4); // 3 coordinates, 4 bytes each
// const pointsArray = new Float32Array(pointsBuffer);
// const distanceSquared = new Float32Array(MAX_POINTS);

// function processCartesianHighData(data, dotNum) {
//   // 確保 dotNum 不超過最大值
//   const numPoints = Math.min(dotNum, MAX_POINTS);
//   let validPoints = 0;

//   for (let i = 0; i < numPoints; i++) {
//     const x = data.readInt32LE(i * 14);
//     const y = data.readInt32LE(i * 14 + 4);
//     const z = data.readInt32LE(i * 14 + 8);

//     // 計算距離的平方（避免開方運算）
//     distanceSquared[i] = x * x + y * y + z * z;

//     // 如果距離平方小於等於 500^2，則保存點
//     if (distanceSquared[i] <= 250000) {
//       // 500^2 = 250000
//       pointsArray[validPoints * 3] = x;
//       pointsArray[validPoints * 3 + 1] = y;
//       pointsArray[validPoints * 3 + 2] = z;
//       validPoints++;
//     }
//   }

//   // 只發送有效的點數據
//   io.emit("points", pointsBuffer.slice(0, validPoints * 3 * 4));
// }
