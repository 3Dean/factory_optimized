// Import the SOMA FM implementation
import { start, cleanup } from './main_with_somafm_fixed.js';

// Export the start and cleanup functions
export { start, cleanup };

// Call the start function when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded, starting application...');
  start();
});
