// Original synthesized effects; no samples or third-party recordings.
// Audio starts only after an explicit user gesture and can be muted at any time.
export class BattleAudio {
  private context: AudioContext | null = null;
  enabled = false;
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ??= new AudioContext();
      await this.context.resume();
      this.drum(this.context.currentTime, .12);
    }
    return this.enabled;
  }
  private drum(time:number, strength:number) {
    if (!this.context) return;
    const oscillator=this.context.createOscillator(), gain=this.context.createGain();
    oscillator.frequency.setValueAtTime(130,time);
    oscillator.frequency.exponentialRampToValueAtTime(45,time+.16);
    gain.gain.setValueAtTime(strength,time);gain.gain.exponentialRampToValueAtTime(.001,time+.23);
    oscillator.connect(gain).connect(this.context.destination);oscillator.start(time);oscillator.stop(time+.25);
  }
  private noise(duration:number, strength:number, cutoff:number) {
    if (!this.context) return;
    const c=this.context, time=c.currentTime, buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate);
    const channel=buffer.getChannelData(0);for(let i=0;i<channel.length;i++)channel[i]=(Math.random()*2-1);
    const source=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter();
    source.buffer=buffer;filter.type='lowpass';filter.frequency.value=cutoff;
    gain.gain.setValueAtTime(strength,time);gain.gain.exponentialRampToValueAtTime(.001,time+duration);
    source.connect(filter).connect(gain).connect(c.destination);source.start();
  }
  play(previous:any, next:any) {
    if(!this.enabled||!this.context||next.lastError)return;
    const before:string[]=previous?.log||[];let overlap=Math.min(before.length,next.log.length);while(overlap>0&&!before.slice(-overlap).every((line,i)=>line===next.log[i]))overlap--;
    const entries:string[]=next.log.slice(overlap);
    if(next.status==='victory'&&previous?.status!=='victory') {
      [0,.18,.36,.7].forEach(delay=>this.drum(this.context!.currentTime+delay,.18));return;
    }
    const text=entries.join(' ');
    if(/metralla|bala rasa|cañón.*dispara/i.test(text)){this.noise(.9,.28,1500);this.drum(this.context.currentTime,.28);}
    else if(/dispara|de daño/.test(text)&&next.smoke.length>previous.smoke.length){this.noise(.45,.2,2800);this.drum(this.context.currentTime,.15);}
    else if(/recarga|ceba|chispa/.test(text))this.noise(.12,.08,5000);
    else if(/hiere|carga contra/.test(text)){this.noise(.16,.09,1800);this.drum(this.context.currentTime,.09);}
    else if(/avanza/.test(text))this.drum(this.context.currentTime,.05);
  }
}
