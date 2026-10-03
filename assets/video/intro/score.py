#!/usr/bin/env python3
"""Original Granaderos intro underscore, synthesized from mathematical signals.

Provenance: composed and written for this repository on 2026-10-03. No recorded
samples, third-party music, external audio, or borrowed melody are used. The
score combines an original arpeggio arrangement with synthesized string modes
and low percussion. NumPy and Python's standard wave module are sufficient.

Run: python3 assets/video/intro/score.py .cache/intro-video/score.wav
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import wave

import numpy as np


def _frequency(midi: int) -> float:
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


def _pluck(midi: int, sr: int, rng: np.random.Generator, bass: bool = False) -> np.ndarray:
    """Damped, slightly detuned string modes with a soft pick transient."""
    length = 3.3 if bass else 2.65
    t = np.arange(round(length * sr), dtype=np.float64) / sr
    f = _frequency(midi)
    result = np.zeros_like(t)
    decay = 1.45 if bass else 0.88
    # The fundamental and low modes dominate; upper modes decay sooner.
    for harmonic in range(1, 9):
        amplitude = math.exp(-0.16 * harmonic) / harmonic ** 1.55
        detune = 0.9993 if harmonic % 2 else 1.0007
        phase = rng.uniform(-0.12, 0.12)
        envelope = np.exp(-t * harmonic ** 0.65 / decay)
        mode = np.sin(2 * np.pi * f * harmonic * detune * t + phase)
        result += amplitude * envelope * mode
    # A slow onset avoids clicks and keeps this below the video captions.
    result *= 1 - np.exp(-t / (0.009 if bass else 0.006))
    noise = rng.standard_normal(len(t))
    noise = np.convolve(noise, np.ones(15) / 15, mode="same")
    result += 0.025 * noise * np.exp(-t / 0.024) * (1 - np.exp(-t / 0.002))
    result[-round(0.12 * sr):] *= np.linspace(1, 0, round(0.12 * sr))
    return result


def _drum(sr: int, rng: np.random.Generator, light: bool = False) -> np.ndarray:
    """Muted low marching drum, with no sharp snare or high-frequency click."""
    t = np.arange(round(0.8 * sr), dtype=np.float64) / sr
    # Integrate a pitch that settles from 96 Hz to 54 Hz.
    phase = 2 * np.pi * (54 * t + 42 * 0.024 * (1 - np.exp(-t / 0.024)))
    skin = np.sin(phase) * np.exp(-t / (0.13 if light else 0.19))
    overtone = 0.18 * np.sin(2 * np.pi * 131 * t) * np.exp(-t / 0.062)
    noise = rng.standard_normal(len(t))
    noise = np.convolve(noise, np.ones(45) / 45, mode="same")
    result = (skin + overtone + 0.35 * noise * np.exp(-t / 0.09))
    return result * (1 - np.exp(-t / 0.006))


def render_score(path: str | Path, duration: float = 45, sr: int = 44100) -> dict:
    """Write deterministic stereo PCM16 audio, with peak capped at -3.5 dBFS."""
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("duration must be a positive finite number")
    if not isinstance(sr, int) or sr < 8000:
        raise ValueError("sr must be an integer of at least 8000 Hz")
    rng = np.random.default_rng(18130203)
    frames = round(duration * sr)
    dry = np.zeros((frames, 2), dtype=np.float64)

    def add(signal: np.ndarray, start: float, gain: float, pan: float = 0) -> None:
        first = round(start * sr)
        if first >= frames:
            return
        count = min(len(signal), frames - first)
        angle = (pan + 1) * np.pi / 4
        dry[first:first + count, 0] += signal[:count] * gain * np.cos(angle)
        dry[first:first + count, 1] += signal[:count] * gain * np.sin(angle)

    beat = 0.75  # 80 beats per minute; each bar lasts three seconds.
    # Low voicings: D minor, B-flat, F, C. The final bars return to D minor.
    progression = [
        (38, (50, 57, 62, 65)), (34, (50, 53, 58, 62)),
        (41, (48, 57, 60, 65)), (36, (48, 55, 60, 64)),
        (38, (50, 57, 62, 65)), (34, (50, 53, 58, 62)),
        (41, (48, 57, 60, 65)), (36, (48, 55, 60, 64)),
        (34, (50, 53, 58, 62)), (41, (48, 57, 60, 65)),
        (36, (48, 55, 60, 64)), (38, (50, 57, 62, 65)),
        (34, (50, 53, 58, 62)), (36, (48, 55, 60, 64)),
        (38, (50, 57, 62, 65)),
    ]
    patterns = [(0, 2, 1, 3, 2, 1, 3, 2), (0, 1, 2, 3, 1, 2, 3, 1)]
    bars = math.ceil(duration / (4 * beat))
    for bar in range(bars):
        start = bar * 4 * beat
        root, chord = progression[bar % len(progression)]
        final_bar = bar == bars - 1
        add(_pluck(root, sr, rng, bass=True), start, 0.25, -0.05)
        if not final_bar:
            add(_pluck(root + 12, sr, rng, bass=True), start + 2 * beat, 0.13, 0.08)
        for step, index in enumerate(patterns[bar % 2]):
            if final_bar and step > 3:
                break
            timing = start + step * beat / 2 + rng.uniform(0.003, 0.015)
            gain = (0.15 if step % 2 == 0 else 0.125) * rng.uniform(0.93, 1.03)
            add(_pluck(chord[index], sr, rng), timing, gain, -0.27 if step % 2 == 0 else 0.27)
        # Percussion enters after the title; sparse accents keep it restrained.
        if 1 <= bar < bars - 1:
            add(_drum(sr, rng), start, 0.075, 0)
            add(_drum(sr, rng, light=True), start + 2 * beat, 0.046, 0.07)
            if bar >= 4 and bar % 2 == 1:
                add(_drum(sr, rng, light=True), start + 3.5 * beat, 0.018, -0.09)

    # Quiet crossed reflections create room without washing out the plucks.
    audio = dry.copy()
    for seconds, amount in [(0.107, 0.065), (0.173, 0.055), (0.307, 0.035), (0.443, 0.025)]:
        delay = round(seconds * sr)
        if delay < frames:
            audio[delay:] += dry[:-delay, ::-1] * amount
    audio -= audio.mean(axis=0, keepdims=True)
    t = np.arange(frames) / sr
    fade_in = np.sin(np.clip(t / min(1.5, duration / 4), 0, 1) * np.pi / 2) ** 2
    fade_out = np.sin(np.clip((duration - t) / min(4, duration / 3), 0, 1) * np.pi / 2) ** 2
    audio *= (fade_in * fade_out)[:, None]
    maximum = float(np.max(np.abs(audio)))
    target_peak = 10 ** (-3.5 / 20)
    audio *= target_peak / max(maximum, 1e-12)
    pcm = np.round(audio * 32767).astype("<i2")
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destination), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(sr)
        output.writeframes(pcm.tobytes())
    peak = float(np.max(np.abs(pcm.astype(np.float64)))) / 32768
    rms = float(np.sqrt(np.mean((pcm.astype(np.float64) / 32768) ** 2)))
    return {
        "path": str(destination), "duration_seconds": frames / sr,
        "sample_rate": sr, "channels": 2, "format": "PCM16",
        "peak_dbfs": round(20 * math.log10(max(peak, 1e-12)), 3),
        "rms_dbfs": round(20 * math.log10(max(rms, 1e-12)), 3),
        "provenance": "Original deterministic synthesis; no external samples or music",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", default=".cache/intro-video/score.wav")
    parser.add_argument("--duration", type=float, default=45)
    parser.add_argument("--sample-rate", type=int, default=44100)
    args = parser.parse_args()
    print(json.dumps(render_score(args.path, args.duration, args.sample_rate), indent=2))
