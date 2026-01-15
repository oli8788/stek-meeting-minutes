/**
 * Audio processing utility to downsample audio files in the browser.
 * Reduces file size by converting to Mono and 8kHz sample rate.
 */

export async function compressAudio(file: File): Promise<Blob> {
    // Check file size before decoding to avoid browser crash (rough limit 100MB)
    if (file.size > 100 * 1024 * 1024) {
        throw new Error("File is too large for browser memory. Please use a shorter or already compressed file.");
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();

    let audioBuffer;
    try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
        throw new Error("Failed to decode audio. The file might be corrupted or in an unsupported format.");
    }

    // Constants - 16kHz provides better transcription accuracy
    const TARGET_SAMPLE_RATE = 16000;
    const numberOfChannels = 1; // Mono

    // Calculate new length
    const newLength = Math.ceil((audioBuffer.length * TARGET_SAMPLE_RATE) / audioBuffer.sampleRate);

    const offlineContext = new OfflineAudioContext(
        numberOfChannels,
        newLength,
        TARGET_SAMPLE_RATE
    );

    // Create buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    // Render to target format
    const renderedBuffer = await offlineContext.startRendering();

    // Convert rendered buffer to WAV Blob
    return bufferToWav(renderedBuffer);
}

function bufferToWav(abuffer: AudioBuffer): Blob {
    const numOfChan = abuffer.numberOfChannels;
    const length = abuffer.length * numOfChan * 2 + 44; // 16-bit
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // write interleaved data
    for (i = 0; i < abuffer.numberOfChannels; i++) {
        channels.push(abuffer.getChannelData(i));
    }

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7fff) | 0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true); // write 16-bit sample
            pos += 2;
        }
        offset++; // next source sample
    }

    return new Blob([buffer], { type: "audio/wav" });

    function setUint16(data: number) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data: number) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}
