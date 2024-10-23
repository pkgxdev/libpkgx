export default async function* readLines(file: Deno.FsFile): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const buffer = new Uint8Array(1024);  // Buffer for reading chunks
  let leftover = '';                    // Leftover string after splitting by newline

  while (true) {
    const bytesRead = await file.read(buffer); // Read a chunk of data

    if (bytesRead === null) break;  // Exit the loop if the end of file is reached

    // Decode the chunk and add any leftover from the previous iteration
    const chunk = leftover + decoder.decode(buffer.subarray(0, bytesRead));

    // Split the chunk by newline
    const lines = chunk.split('\n');

    // Yield all lines except the last, which may be incomplete
    for (let i = 0; i < lines.length - 1; i++) {
      yield lines[i];
    }

    // Keep the last part as leftover (which could be incomplete)
    leftover = lines[lines.length - 1];
  }

  // If there's any remaining data in leftover, yield it as the last line
  if (leftover) {
    yield leftover;
  }
}
