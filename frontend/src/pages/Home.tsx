import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, Coins, Music4 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/** Lightweight stand-in for the old WebGL hero — a few animated bars. */
const Equaliser: React.FC = () => {
  const bars = [0.45, 0.8, 0.35, 1, 0.6, 0.9, 0.5];
  return (
    <div className="flex items-end gap-[5px] h-14" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="eq-bar w-[5px] rounded-full bg-brand-500"
          style={{
            height: `${h * 100}%`,
            animationDelay: `${i * 0.13}s`,
            animationDuration: `${0.85 + (i % 3) * 0.22}s`,
          }}
        />
      ))}
    </div>
  );
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, role, djProfileComplete } = useAuth();

  // Signed-in visitors skip the pitch and go where they belong
  const goToApp = () => {
    if (!user || role === null) return navigate('/login');
    if (role === 'dj') return navigate(djProfileComplete ? '/dj' : '/dj-setup');
    navigate('/customer');
  };

  const steps = [
    {
      Icon: Search,
      title: 'Find the DJ',
      body: 'Open BeatBiddr at the venue and see who is playing right now.',
    },
    {
      Icon: Music4,
      title: 'Pick your track',
      body: 'Search Spotify, choose a song, and add a tip.',
    },
    {
      Icon: Coins,
      title: 'Jump the queue',
      body: 'Bigger tips move up the line. Watch your position live.',
    },
  ];

  return (
    <div className="min-h-dvh bg-dark-600 text-white">
      {/* header */}
      <header className="safe-top">
        <div className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
          <span className="text-[17px] font-extrabold tracking-[-0.03em]">
            Beat<span className="text-brand-500">Biddr</span>
          </span>
          <button
            onClick={goToApp}
            className="text-[14px] font-bold text-neutral-300 hover:text-white transition-colors"
          >
            {user ? 'Open app' : 'Sign in'}
          </button>
        </div>
      </header>

      <main className="px-6 max-w-3xl mx-auto">
        {/* hero */}
        <section className="pt-10 pb-16">
          <Equaliser />

          <h1 className="text-[clamp(38px,11vw,62px)] font-extrabold tracking-[-0.045em] leading-[0.98] mt-8 text-balance">
            Hear your song
            <br />
            <span className="text-brand-500">tonight.</span>
          </h1>

          <p className="text-[16px] text-neutral-400 mt-5 leading-relaxed max-w-[36ch]">
            Request tracks from the DJ who's playing right now, and tip to move up
            the queue. No app to install.
          </p>

          <button
            onClick={goToApp}
            className="btn-primary w-full mt-8 flex items-center justify-center gap-2"
          >
            Get started
            <ArrowRight size={17} />
          </button>

          <p className="text-[12.5px] text-neutral-500 mt-3.5 text-center">
            Free to join · Pay only when you request
          </p>
        </section>

        {/* how it works — genuinely a sequence, so the numbers mean something */}
        <section className="pb-16">
          <p className="label mb-6">How it works</p>
          <ol className="flex flex-col">
            {steps.map(({ Icon, title, body }, i) => (
              <li
                key={title}
                className="flex gap-4 py-5 border-b border-white/[0.09] last:border-0"
              >
                <span className="shrink-0 w-9 h-9 rounded-xl bg-dark-400 flex items-center justify-center">
                  <Icon size={17} className="text-brand-500" />
                </span>
                <div className="min-w-0">
                  <p className="text-[16px] font-bold tracking-[-0.02em]">
                    <span className="text-neutral-600 tnum mr-2">{i + 1}</span>
                    {title}
                  </p>
                  <p className="text-[13.5px] text-neutral-400 mt-1 leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* for DJs */}
        <section className="pb-16">
          <div className="card p-6">
            <p className="label mb-3">For DJs</p>
            <h2 className="text-[22px] font-extrabold tracking-[-0.035em] leading-tight">
              Get paid for the requests you were taking anyway.
            </h2>
            <p className="text-[13.5px] text-neutral-400 mt-3 leading-relaxed">
              See every request ranked by tip, accept the ones you want, and keep the
              money. No cover charge, no paperwork.
            </p>
            <button onClick={goToApp} className="btn-ghost w-full mt-5">
              Sign up as a DJ
            </button>
          </div>
        </section>

        {/* closing */}
        <section className="pb-20 text-center">
          <h2 className="text-[26px] font-extrabold tracking-[-0.04em] leading-tight text-balance">
            The next song is up to you.
          </h2>
          <button onClick={goToApp} className="btn-primary w-full mt-6">
            Get started
          </button>
        </section>
      </main>

      <footer className="border-t border-white/[0.09] safe-bottom">
        <div className="px-6 py-6 max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-[12.5px] text-neutral-600">
            © {new Date().getFullYear()} BeatBiddr
          </span>
          <div className="flex gap-5 text-[12.5px] text-neutral-500">
            <button className="hover:text-neutral-300 transition-colors">Terms</button>
            <button className="hover:text-neutral-300 transition-colors">Privacy</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
