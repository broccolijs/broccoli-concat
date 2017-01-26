module.exports = {
  /**
   * Given an array of numbers, return the average.
   */
  average(nums) {
    let sum = nums.reduce((sum,val) => sum + val);
    return sum / nums.length;
  },

  /**
   * Given a file path, return the path minus the extension. Useful for using
   * paths as names/titles.
   */
  stripExtension(file) {
    return file.split('.').slice(0, -1).join('.');
  }
};
