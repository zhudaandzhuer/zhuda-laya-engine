"""The island's sounds, synthesised from numbers (no recordings): ambience loops
and one-shot effects. The same seed gives the same files.

    python3 source/sfx.py           # from prefabs/3d/island-sound: writes assets/audio/*.m4a
                                    # (the .wav masters go to $SFX_WORK, else a temporary folder)

Loops are made seamless by cross-fading their end into their start.
"""
import os
import subprocess
import tempfile
import numpy as np
from scipy import signal

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get('SFX_WORK') or tempfile.mkdtemp(prefix='island-sfx-')
OUT = os.path.join(HERE, '..', 'assets', 'audio')
os.makedirs(WORK, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(20261116)


def t_of(sec):
    return np.arange(int(sec * SR)) / SR


def white(n):
    return rng.standard_normal(n)


def pink(n):
    f = np.fft.rfft(white(n))
    k = np.arange(len(f))
    k[0] = 1
    return np.fft.irfft(f / np.sqrt(k), n)


def brown(n):
    x = np.cumsum(white(n))
    x -= signal.lfilter([1], [1, -0.9995], x) * 0  # keep it simple
    return signal.lfilter([1, -1], [1, -0.995], x)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def lp(x, hz, order=2):
    return signal.sosfilt(signal.butter(order, hz, 'lowpass', fs=SR, output='sos'), x, axis=-1)


def hp(x, hz, order=2):
    return signal.sosfilt(signal.butter(order, hz, 'highpass', fs=SR, output='sos'), x, axis=-1)


def env(n, attack, release, hold=0.0, curve=3.0):
    """Attack (s), hold (s), exponential release (s), over n samples."""
    e = np.zeros(n)
    a, h = int(attack * SR), int(hold * SR)
    a = max(a, 1)
    e[:a] = np.linspace(0, 1, a)[: min(a, n)] if a <= n else np.linspace(0, 1, n)
    if a < n:
        e[a:a + h] = 1
        rest = n - a - h
        if rest > 0:
            e[a + h:] = np.exp(-np.arange(rest) / SR * curve / max(release, 1e-3))
    return e


def slow(n, rate, depth, seed_phase=0.0):
    """A slow random wobble 1 +- depth, changing about `rate` times a second."""
    pts = int(n / SR * rate) + 3
    knots = rng.uniform(-1, 1, pts)
    x = np.interp(np.arange(n) / SR * rate, np.arange(pts), knots)
    return 1 + depth * x


def reverb(x, seconds=1.2, mix=0.25, damp=3000):
    n = int(seconds * SR)
    ir = white(n) * np.exp(-np.arange(n) / SR * 6.9 / seconds)
    ir = lp(ir, damp)
    ir /= np.sqrt(np.sum(ir ** 2))
    if x.ndim == 2:
        return np.stack([reverb(c, seconds, mix, damp) for c in x])
    wet = signal.fftconvolve(x, ir)[: len(x)]
    return (1 - mix) * x + mix * wet * 0.6


def stereo(make):
    return np.stack([make(), make()])


def loopify(x, fade=1.5):
    """Cross-fades the tail into the head so the file loops without a seam."""
    f = int(fade * SR)
    head, body, tail = x[..., :f], x[..., f:-f], x[..., -f:]
    w = np.linspace(0, 1, f)
    joined = tail * (1 - w) + head * w
    return np.concatenate([body, joined], axis=-1)


def place(dst, src, at):
    i = int(at * SR)
    j = min(dst.shape[-1], i + src.shape[-1])
    if i >= dst.shape[-1]:
        return
    dst[..., i:j] += src[..., : j - i]


def write(name, x, peak=0.9, bitrate='112k'):
    x = norm(x, peak)
    if x.ndim == 1:
        x = x[None, :]
    data = (np.clip(x.T, -1, 1) * 32767).astype(np.int16)
    wav = os.path.join(WORK, name + '.wav')
    import wave
    with wave.open(wav, 'wb') as w:
        w.setnchannels(data.shape[1])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    m4a = os.path.join(OUT, name + '.m4a')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', bitrate, m4a], check=True)
    print(name, round(x.shape[-1] / SR, 2), 's', os.path.getsize(m4a), 'bytes')


# ---------------------------------------------------------------- pieces
def chirp(f0, f1, dur, harmonics=(1, 0.3), vib=0.0):
    t = t_of(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    if vib:
        f = f * (1 + 0.04 * np.sin(2 * np.pi * vib * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = sum(a * np.sin(ph * (k + 1)) for k, a in enumerate(harmonics))
    return y * env(len(t), 0.004, dur * 0.6, hold=dur * 0.2, curve=4)


def bird_song():
    """A short phrase of a small songbird: 3-7 quick notes, up-down, sometimes a trill."""
    out = []
    base = rng.uniform(2600, 4200)
    for k in range(rng.integers(3, 8)):
        if rng.random() < 0.25:
            trill = np.concatenate([chirp(base * 1.1, base * 1.3, 0.025) for _ in range(rng.integers(4, 9))])
            out.append(trill)
        else:
            a = base * rng.uniform(0.8, 1.3)
            out.append(chirp(a, a * rng.uniform(0.6, 1.5), rng.uniform(0.05, 0.14), vib=rng.uniform(0, 40)))
        out.append(np.zeros(int(rng.uniform(0.02, 0.09) * SR)))
    return np.concatenate(out)


def droplet(f=None):
    """One raindrop on a leaf or the ground: a tiny damped ping with a click."""
    f = f or rng.uniform(1800, 5000)
    d = rng.uniform(0.02, 0.06)
    t = t_of(d)
    ping = np.sin(2 * np.pi * (f * (1 + 0.5 * np.exp(-t * 80))) * t) * np.exp(-t * rng.uniform(60, 140))
    click = hp(white(len(t)), 3000) * np.exp(-t * 400) * 0.6
    return ping * 0.5 + click


def rustle(dur, bright=3000):
    n = int(dur * SR)
    x = bp(white(n), 1200, bright + 2000)
    grains = (rng.random(n) < 0.002).astype(float)
    grains = signal.lfilter([1], [1, -0.995], grains)
    return x * (0.3 + grains) * env(n, dur * 0.2, dur * 0.4, hold=dur * 0.3, curve=3)


# ---------------------------------------------------------------- ambience loops
def amb_day(sec=40):
    n = int(sec * SR)
    out = np.zeros((2, n))
    # a light breeze in the grass
    breeze = stereo(lambda: bp(pink(n), 250, 1800) * slow(n, 0.25, 0.6))
    out += breeze * 0.35
    # leaves rustling in gusts
    for k in range(10):
        r = rustle(rng.uniform(1.5, 3.5))
        place(out, np.stack([r * rng.uniform(0.3, 1), r * rng.uniform(0.3, 1)]) * 0.25, rng.uniform(0, sec - 4))
    # birds near and far
    for k in range(int(sec / 2.2)):
        s = bird_song()
        pan = rng.uniform(0.15, 0.85)
        far = rng.uniform(0.25, 1)
        s = reverb(lp(s, 9000), 0.9, 0.35) * far
        place(out, np.stack([s * (1 - pan), s * pan]), rng.uniform(0, sec - 2))
    return loopify(out)


def amb_night(sec=40):
    n = int(sec * SR)
    out = np.zeros((2, n))
    out += stereo(lambda: bp(pink(n), 150, 900) * slow(n, 0.2, 0.5)) * 0.25
    # crickets: pulsed tones in chirps of 3-5, each cricket its own pitch and rhythm
    for c in range(7):
        f = rng.uniform(3800, 5200)
        rate = rng.uniform(1.2, 2.2)  # chirps a second
        pulses = rng.integers(3, 6)
        pan = rng.uniform(0.1, 0.9)
        gain = rng.uniform(0.15, 0.5)
        t = np.arange(n) / SR
        chirp_gate = ((t * rate + rng.random()) % 1) < pulses * 0.018
        pulse_gate = (np.sin(2 * np.pi * pulses / (pulses * 0.018) * t * 0.5) > 0)
        tone = np.sin(2 * np.pi * f * t) * chirp_gate * pulse_gate
        tone = lp(tone, 7000) * slow(n, 0.1, 0.4)
        out += np.stack([tone * (1 - pan), tone * pan]) * gain
    # a frog now and then
    for k in range(int(sec / 6)):
        d = 0.25
        t = t_of(d)
        croak = signal.sawtooth(2 * np.pi * rng.uniform(110, 160) * t) * (np.sin(2 * np.pi * 30 * t) > 0) * env(len(t), 0.01, 0.1, hold=0.12)
        croak = bp(croak, 200, 1500) * 0.35
        for r in range(rng.integers(1, 3)):
            place(out, np.stack([croak, croak * 0.7]), rng.uniform(0, sec - 1) + r * 0.35)
    return loopify(reverb(out, 1.5, 0.2))


def amb_rain(sec=30, heavy=False):
    n = int(sec * SR)
    hiss = stereo(lambda: bp(pink(n), 500 if heavy else 800, 9000) * slow(n, 0.3, 0.25))
    out = hiss * (0.5 if heavy else 0.35)
    body = stereo(lambda: lp(brown(n), 400) * slow(n, 0.2, 0.3))
    out += norm(body, 0.25 if heavy else 0.12)
    count = int(sec * (900 if heavy else 380))
    for k in range(count):
        d = droplet()
        pan = rng.uniform(0, 1)
        g = rng.uniform(0.02, 0.12)
        place(out, np.stack([d * (1 - pan), d * pan]) * g, rng.uniform(0, sec - 0.1))
    # drips from the eaves: slower, louder, lower
    for k in range(int(sec * 1.5)):
        d = droplet(rng.uniform(900, 1600)) * 0.25
        place(out, np.stack([d * 0.8, d]), rng.uniform(0, sec - 0.1))
    return loopify(out)


def amb_wind(sec=30, strong=False):
    """The air at the island's height: a broad roar that swells, and a whistle on gusts."""
    n = int(sec * SR)
    gust = slow(n, 0.15 if not strong else 0.3, 0.7)
    gust = np.clip(gust, 0.2, None)
    roar = stereo(lambda: lp(brown(n), 600 if strong else 350))
    out = norm(roar, 0.6) * gust
    t = np.arange(n) / SR
    for k in range(2):
        whistle_f = 600 * slow(n, 0.2, 0.25) * (1 + k * 0.6)
        w = bp(white(n), 500 + k * 400, 1400 + k * 700) * np.clip(gust - 1, 0, None) * (0.6 if strong else 0.25)
        out += np.stack([w, w * 0.8])
    return loopify(out)


def windmill_creak(sec=12):
    """Wooden sails turning: a low creak once a turn, a soft knock of the shaft."""
    n = int(sec * SR)
    out = np.zeros(n)
    turn = 4.0
    for k in range(int(sec / turn) + 1):
        at = k * turn + rng.uniform(-0.1, 0.1)
        d = rng.uniform(0.5, 0.9)
        t = t_of(d)
        f = 140 * (1 + 0.6 * np.sin(np.pi * t / d)) + 10 * rng.standard_normal(len(t)).cumsum() / np.sqrt(SR) * 4
        stick = (np.sin(2 * np.pi * np.cumsum(f) / SR * 3) > 0.6).astype(float)
        creak = bp(stick * white(len(t)) + signal.sawtooth(2 * np.pi * np.cumsum(f) / SR), 300, 2400) * env(len(t), 0.08, d * 0.5, hold=d * 0.3)
        place(out[None], creak[None] * 0.5, max(0, at))
        knock = lp(white(int(0.08 * SR)), 500) * env(int(0.08 * SR), 0.002, 0.05)
        place(out[None], knock[None] * 0.6, max(0, at + turn / 2))
    return loopify(reverb(out, 0.6, 0.2), 0.5)


def fire_place(sec=10):
    return None


# ---------------------------------------------------------------- one-shots
def thunder(near=True, sec=7):
    n = int(sec * SR)
    out = np.zeros((2, n))
    if near:
        crack = hp(white(int(0.25 * SR)), 900) * env(int(0.25 * SR), 0.001, 0.12)
        for k in range(5):
            place(out, np.stack([crack, crack * 0.8]) * rng.uniform(0.4, 1), k * rng.uniform(0.02, 0.06))
    rumble = stereo(lambda: lp(brown(n), 160 if near else 110))
    rumble = norm(rumble, 1) * env(n, 0.15 if near else 0.6, sec * 0.5, hold=0.6, curve=2.5)
    rumble *= slow(n, 3, 0.6)
    out += rumble * (0.8 if near else 0.6)
    return reverb(out, 2.5, 0.35, 1500)


def thump(hard=False):
    d = 0.45
    t = t_of(d)
    f = (90 if hard else 120) * np.exp(-t * 9) + 40
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.25)
    grass = rustle(0.35, 4000) * 0.6
    x = body + np.pad(grass, (0, len(t) - len(grass)))
    if hard:
        x += lp(white(len(t)), 900) * env(len(t), 0.001, 0.08) * 0.8
    return reverb(x, 0.5, 0.15)


def roof_clonk():
    d = 0.5
    t = t_of(d)
    x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * dmp) * a for f, dmp, a in ((420, 18, 1), (980, 30, 0.6), (1710, 45, 0.4), (2600, 60, 0.25)))
    x += bp(white(len(t)), 800, 4000) * np.exp(-t * 60) * 0.7
    return reverb(x, 0.4, 0.15)


def splash(big=True):
    d = 1.4 if big else 0.6
    n = int(d * SR)
    t = np.arange(n) / SR
    burst = bp(white(n), 400, 7000) * env(n, 0.004, d * 0.35)
    gulp_f = (500 if big else 900) * np.exp(-t * 6) + 180
    gulp = np.sin(2 * np.pi * np.cumsum(gulp_f) / SR) * env(n, 0.01, 0.25) * 0.5
    x = burst + gulp
    for k in range(40 if big else 10):
        place(x[None], droplet(rng.uniform(1200, 3500))[None] * rng.uniform(0.05, 0.25), rng.uniform(0.15, d * 0.8))
    return reverb(x, 0.6, 0.2)


def paddle():
    d = 0.35
    n = int(d * SR)
    x = bp(white(n), 300, 3000) * env(n, 0.03, 0.15, hold=0.05)
    for k in range(4):
        place(x[None], droplet(rng.uniform(1000, 2500))[None] * 0.15, rng.uniform(0.05, 0.25))
    return x


def whoosh(d=0.8):
    n = int(d * SR)
    t = np.arange(n) / SR
    centre = 400 + 2200 * np.sin(np.pi * t / d) ** 2
    x = np.zeros(n)
    w = white(n)
    for i in range(0, n, 512):  # moving band, in blocks
        seg = slice(i, min(n, i + 1024))
        c = centre[i]
        x[seg] += bp(w[seg], max(80, c * 0.6), min(SR / 2 - 100, c * 1.6))[: len(x[seg])] * 0.5
    return x * np.sin(np.pi * t / d) ** 1.5


def slide_whistle_down(d=1.3):
    t = t_of(d)
    f = 1800 * (300 / 1800) ** (t / d)
    f = f * (1 + 0.02 * np.sin(2 * np.pi * 6 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.2 * np.sin(2 * ph) + 0.05 * hp(white(len(t)), 4000)
    return x * env(len(t), 0.03, 0.3, hold=d - 0.35)


def poof():
    d = 0.7
    n = int(d * SR)
    x = lp(white(n), 1800) * env(n, 0.01, 0.3) + bp(white(n), 2000, 6000) * env(n, 0.005, 0.08) * 0.3
    return reverb(x, 0.8, 0.3)


def sparkle(notes=(1568, 2093, 2637, 3136), gap=0.06):
    out = np.zeros(int((len(notes) * gap + 0.8) * SR))
    for k, f in enumerate(notes):
        t = t_of(0.7)
        bell = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 8)) * np.exp(-t * 5)
        place(out[None], bell[None] * 0.6, k * gap)
    return reverb(out, 1.0, 0.3)


def pop():
    d = 0.18
    t = t_of(d)
    f = 500 + 900 * (1 - np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.08)


def step_grass():
    return rustle(0.18, 3500) * 0.8 + lp(white(int(0.18 * SR)), 300) * env(int(0.18 * SR), 0.003, 0.05) * 0.5


def squish():
    d = 0.25
    n = int(d * SR)
    t = np.arange(n) / SR
    x = bp(white(n), 300, 2500) * env(n, 0.01, 0.1, hold=0.04)
    x += np.sin(2 * np.pi * np.cumsum(300 + 600 * t / d) / SR) * env(n, 0.02, 0.08) * 0.2
    return x


def shake_spray():
    d = 1.2
    n = int(d * SR)
    out = np.zeros(n)
    for k in range(9):
        burst = bp(white(int(0.09 * SR)), 1500, 8000) * env(int(0.09 * SR), 0.004, 0.05)
        place(out[None], burst[None] * rng.uniform(0.5, 1), k * 0.11)
        for j in range(3):
            place(out[None], droplet()[None] * 0.15, k * 0.11 + rng.uniform(0.05, 0.3))
    return out


def grab_cloth():
    return rustle(0.25, 2500)


def dizzy_twinkle():
    return sparkle((2637, 2349, 2637, 3136, 2793), 0.09)


def heart():
    return sparkle((1047, 1319, 1568), 0.07)


def click():
    t = t_of(0.05)
    return np.sin(2 * np.pi * 1400 * t) * np.exp(-t * 120)


if __name__ == '__main__':
    write('amb-day', amb_day(), 0.8)
    write('amb-night', amb_night(), 0.8)
    write('amb-rain', amb_rain(), 0.8)
    write('amb-storm', amb_rain(heavy=True), 0.85)
    write('amb-wind', amb_wind(), 0.7)
    write('amb-gale', amb_wind(strong=True), 0.85)
    write('windmill', windmill_creak(), 0.8)
    for k in range(3):
        write(f'thunder-{k + 1}', thunder(near=k == 0, sec=7 if k == 0 else 6), 0.95, '128k')
    write('thump', thump(False), 0.9)
    write('thump-hard', thump(True), 0.95)
    write('roof', roof_clonk(), 0.9)
    write('splash', splash(True), 0.95)
    write('splash-small', splash(False), 0.8)
    write('paddle', paddle(), 0.7)
    write('whoosh', whoosh(0.8), 0.85)
    write('slide-whistle', slide_whistle_down(), 0.7)
    write('poof', poof(), 0.8)
    write('sparkle', sparkle(), 0.7)
    write('dizzy', dizzy_twinkle(), 0.6)
    write('heart', heart(), 0.6)
    write('pop', pop(), 0.6)
    write('step-1', step_grass(), 0.5)
    write('step-2', step_grass(), 0.5)
    write('squish', squish(), 0.6)
    write('shake', shake_spray(), 0.8)
    write('grab', grab_cloth(), 0.7)
    write('click', click(), 0.4)
