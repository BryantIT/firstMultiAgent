/**
 * Returns a new array containing the elements of `array` sorted in the
 * given `direction`. Does not mutate the input array.
 *
 * Assumes `array` contains either all numbers or all strings (no mixed
 * types). Numbers are sorted numerically; strings are sorted
 * lexicographically using default JS string comparison.
 *
 * @param {Array<number|string>} array - The array to sort.
 * @param {string} direction - "ascending" or "descending" (case-insensitive).
 * @returns {Array<number|string>} A new sorted array.
 * @throws {Error} If `direction` is not a recognized value.
 */
function sortArray(array, direction) {
  const normalizedDirection =
    typeof direction === "string" ? direction.toLowerCase() : direction;

  if (
    normalizedDirection !== "ascending" &&
    normalizedDirection !== "descending"
  ) {
    throw new Error(
      `Invalid direction "${direction}". Expected "ascending" or "descending".`
    );
  }

  const sorted = [...array].sort((a, b) => {
    if (typeof a === "number" && typeof b === "number") {
      return a - b;
    }
    // Fall back to lexicographic comparison for strings (and anything
    // else that supports relational operators).
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });

  if (normalizedDirection === "descending") {
    sorted.reverse();
  }

  return sorted;
}

module.exports = sortArray;

// Example usage:
//
// const sortArray = require("./sortArray");
//
// sortArray([5, 1, 10, 2], "ascending");
// // => [1, 2, 5, 10]
//
// sortArray([5, 1, 10, 2], "descending");
// // => [10, 5, 2, 1]
//
// sortArray(["banana", "apple", "cherry"], "ASCENDING");
// // => ["apple", "banana", "cherry"]  (direction is case-insensitive)
//
// sortArray([3, 1, 2], "sideways");
// // => throws Error: Invalid direction "sideways". Expected "ascending" or "descending".
