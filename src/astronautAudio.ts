// Replace these six files with your own sounds; no changes to the scene are needed.
export const flightAudioFiles = ['generic.ogg', 'cinematic_0.ogg', 'cinematic_2.ogg', 'cinematic_3.ogg', 'generic_end.ogg', 'glass_broken.ogg'];
const root = `${import.meta.env.BASE_URL}assets/astronaut/audio/`;
const smooth = (from: number, to: number, value: number) => {
    const x = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return x * x * (3 - 2 * x);
};

export class AstronautAudio {
    private master: GainNode;
    private layers: { source: AudioBufferSourceNode; gain: GainNode; started: boolean }[] = [];
    private glass: AudioBuffer | null = null;
    private hits = new Set<AudioBufferSourceNode>();
    private previous = 0;
    private disposed = false;
    private abort = new AbortController();
    constructor(private context: AudioContext, onError: () => void) {
        this.master = context.createGain();
        this.master.gain.value = 0;
        this.master.connect(context.destination);
        void Promise.all(flightAudioFiles.map(async file => {
            const response = await fetch(root + file, { signal: this.abort.signal });
            if (!response.ok) throw new Error(`Audio ${file}: ${response.status}`);
            return context.decodeAudioData(await response.arrayBuffer());
        })).then(buffers => {
            if (this.disposed) return;
            this.glass = buffers[5];
            this.layers = buffers.slice(0, 5).map(buffer => {
                const source = context.createBufferSource(), gain = context.createGain();
                source.buffer = buffer; source.loop = true; gain.gain.value = 0;
                source.connect(gain); gain.connect(this.master);
                return { source, gain, started: false };
            });
        }).catch(() => { if (!this.disposed) onError(); });
    }
    update(progress: number, speed: number, playing: boolean) {
        const now = this.context.currentTime;
        if (progress < this.previous - .2) this.layers.forEach(layer => {
            const buffer = layer.source.buffer;
            if (layer.started) layer.source.stop();
            layer.source.disconnect();
            layer.source = this.context.createBufferSource(); layer.source.buffer = buffer; layer.source.loop = true;
            layer.source.connect(layer.gain); layer.started = false;
        });
        this.master.gain.setTargetAtTime(playing ? .7 : 0, now, .06);
        const levels = [
            .16 * smooth(.16, .3, progress) * (1 - smooth(.70, .8, progress)),
            .3 * smooth(.22, .34, progress) * (1 - smooth(.47, .55, progress)),
            .34 * smooth(.47, .57, progress) * (1 - smooth(.69, .74, progress)),
            .58 * smooth(.70, .735, progress) * (1 - smooth(.835, .86, progress)),
            .28 * smooth(.84, .93, progress),
        ];
        this.layers.forEach((layer, i) => {
            const { source, gain } = layer;
            if (playing && levels[i] > .001 && !layer.started) { source.start(); layer.started = true; }
            gain.gain.setTargetAtTime(levels[i], now, .12);
            source.playbackRate.setTargetAtTime(i === 4 ? 1 : Math.min(2.8, 1 + (speed - 1) * .55), now, .1);
        });
        if (playing && this.glass && this.previous < .835 && progress >= .835 && progress < .87) {
            const hit = this.context.createBufferSource(); hit.buffer = this.glass;
            hit.connect(this.master); this.hits.add(hit);
            hit.onended = () => { this.hits.delete(hit); hit.disconnect(); };
            hit.start();
        }
        this.previous = progress;
    }
    dispose() {
        this.disposed = true; this.abort.abort();
        this.layers.forEach(({ source, gain, started }) => { if (started) source.stop(); source.disconnect(); gain.disconnect(); });
        this.hits.forEach(source => { source.stop(); source.disconnect(); });
        this.hits.clear(); this.master.disconnect();
    }
}
