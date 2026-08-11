// ==================================================================
// Async route handler wrapper.
// Express 4 does not catch rejected promises, so every async route is
// wrapped and forwarded to the central error handler.
// ==================================================================
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
