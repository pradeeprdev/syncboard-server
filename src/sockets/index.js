let io = null;

export const initIO = (serverIO) => {
  io = serverIO;
};

export const getIO = () => io;
