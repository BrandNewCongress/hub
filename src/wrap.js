/* This is a function wrapper to correctly
 catch and handle uncaught exceptions in
 asynchronous code. */
module.exports = (fn) =>
  (...args) =>
    fn(...args)
      .catch((ex) => {
        process.nextTick(() => { throw ex })
      })
