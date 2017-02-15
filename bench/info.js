console.log('Benchmarking with the following parameters');
console.log('------------------------------------------');
console.log(`FILE_COUNT: ${process.env.FILE_COUNT || 10}`);
console.log(`DEPTH: ${process.env.DEPTH || 1}`);
console.log(`LARGE_FILES: ${!!process.env.LARGE_FILES}`);
console.log('------------------------------------------');
