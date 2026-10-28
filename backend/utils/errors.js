function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
function publicError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}
module.exports = { asyncHandler, publicError };
