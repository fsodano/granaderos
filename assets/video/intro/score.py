#!/usr/bin/env python3
"""Original Granaderos historical underscore, synthesized from signals.

No recorded samples, third-party music, external audio, or borrowed melody are
used. The original arrangement combines low bowed-string modes, restrained
plucked strings, an original woodwind phrase, and a muted marching drum. Its
dynamic arc follows the trailer's opening, campaign, combat and closing title.
NumPy and Python's standard wave module are sufficient.

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


def _bow(midi: int, sr: int, length: float = 3.8) -> np.ndarray:
    """Warm low string, with a slow bow envelope and restrained upper modes."""
    t = np.arange(round(length * sr), dtype=np.float64) / sr
    frequency = _frequency(midi)
    vibrato = 0.004 * np.sin(2 * np.pi * 4.6 * t) * np.minimum(t / 0.6, 1)
    phase = 2 * np.pi * frequency * np.cumsum(1 + vibrato) / sr
    signal = np.zeros_like(t)
    for harmonic in range(1, 7):
        signal += np.sin(harmonic * phase) / harmonic ** 1.9
    attack = np.sin(np.minimum(t / 0.38, 1) * np.pi / 2) ** 2
    release = np.sin(np.clip((length - t) / 0.85, 0, 1) * np.pi / 2) ** 2
    return signal * attack * release * (0.85 + 0.15 * np.exp(-t / 2))


def _woodwind(midi: int, sr: int, length: float = 0.65) -> np.ndarray:
    """A soft, breath-shaped pipe tone for the score's own short melody."""
    t = np.arange(round(length * sr), dtype=np.float64) / sr
    frequency = _frequency(midi)
    phase = 2 * np.pi * frequency * t + 0.022 * np.sin(2 * np.pi * 5.2 * t)
    signal = np.sin(phase) + 0.10 * np.sin(2 * phase) + 0.055 * np.sin(3 * phase)
    attack = np.sin(np.minimum(t / 0.10, 1) * np.pi / 2) ** 2
    release = np.sin(np.clip((length - t) / 0.18, 0, 1) * np.pi / 2) ** 2
    return signal * attack * release


def render_score(path: str | Path, duration: float = 56, sr: int = 44100) -> dict:
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
    # Low voicings: D minor, B-flat, F, C, then A and a final D-minor cadence.
    progression = [
        (38, (50, 57, 62, 65)), (34, (50, 53, 58, 62)),
        (41, (48, 57, 60, 65)), (36, (48, 55, 60, 64)),
        (38, (50, 57, 62, 65)), (34, (50, 53, 58, 62)),
        (41, (48, 57, 60, 65)), (36, (48, 55, 60, 64)),
        (34, (50, 53, 58, 62)), (41, (48, 57, 60, 65)),
        (36, (48, 55, 60, 64)), (38, (50, 57, 62, 65)),
        (34, (50, 53, 58, 62)), (36, (48, 55, 60, 64)),
        (38, (50, 57, 62, 65)), (34, (50, 53, 58, 62)),
        (33, (49, 52, 57, 61)), (38, (50, 57, 62, 65)),
        (38, (50, 57, 62, 65)),
    ]
    patterns = [(0, 2, 1, 3, 2, 1, 3, 2), (0, 1, 2, 3, 1, 2, 3, 1)]
    bars = math.ceil(duration / (4 * beat))
    for bar in range(bars):
        start = bar * 4 * beat
        root, chord = progression[bar % len(progression)]
        final_bar = bar == bars - 1
        combat = 29 <= start < 51
        title = start < 7
        closing = start >= 51
        strength = 0.80 if title else (1.10 if combat else 0.94)
        add(_pluck(root, sr, rng, bass=True), start, 0.21 * strength, -0.05)
        add(_bow(root + 12, sr), start, 0.040 if title else 0.032, -0.16)
        add(_bow(chord[1], sr), start + 0.10, 0.018 if title else 0.015, 0.16)
        if not final_bar and not closing:
            add(_pluck(root + 12, sr, rng, bass=True), start + 2 * beat, 0.10 * strength, 0.08)
        for step, index in enumerate(patterns[bar % 2]):
            if (final_bar or closing) and step > 3:
                break
            if title and step % 2:
                continue
            timing = start + step * beat / 2 + rng.uniform(0.003, 0.015)
            gain = (0.10 if step % 2 == 0 else 0.072) * strength * rng.uniform(0.93, 1.03)
            add(_pluck(chord[index], sr, rng), timing, gain, -0.27 if step % 2 == 0 else 0.27)
        # A low march enters with recruitment, grows in combat, then falls away.
        if start >= 6 and not closing and not final_bar:
            add(_drum(sr, rng), start, 0.10 if combat else 0.067, 0)
            add(_drum(sr, rng, light=True), start + 2 * beat, 0.068 if combat else 0.040, 0.07)
            if combat:
                add(_drum(sr, rng, light=True), start + beat, 0.023, -0.08)
                add(_drum(sr, rng, light=True), start + 3 * beat, 0.028, 0.08)
                add(_drum(sr, rng, light=True), start + 3.5 * beat, 0.016, -0.06)

    # Newly composed phrase: sparse in the campaign, answered during combat.
    motif = [(0, 74, 0.9), (1.5, 72, 0.6), (2.25, 69, 1.25),
             (3.75, 67, 0.6), (4.5, 69, 1.25)]
    for phrase_start, gain in [(9, 0.022), (18, 0.028), (30, 0.038), (39, 0.040), (45, 0.028)]:
        for offset, note, length in motif:
            add(_woodwind(note, sr, length), phrase_start + offset, gain, -0.06)
    if duration > 51:
        add(_bow(50, sr, length=5), 51, 0.044, -0.15)
        add(_bow(57, sr, length=5), 51.15, 0.028, 0.15)
        add(_woodwind(74, sr, length=2.5), 51.4, 0.027, 0)

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
        "arrangement": "Original low strings, plucked strings, woodwind phrase and muted marching drum",
        "story_sections_seconds": {"historical_opening": [0, 7], "campaign": [7, 29],
                                    "combat": [29, 51], "closing_title": [51, 56]},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", default=".cache/intro-video/score.wav")
    parser.add_argument("--duration", type=float, default=56)
    parser.add_argument("--sample-rate", type=int, default=44100)
    args = parser.parse_args()
    print(json.dumps(render_score(args.path, args.duration, args.sample_rate), indent=2))
