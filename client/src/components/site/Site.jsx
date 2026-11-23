import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PLAY_STORE_URL } from "../../lib/links.js";
import "./site.css";

const STEPS = [
  {
    kicker: "Ask",
    title: "Say the trip the way you’d say it to a friend.",
    body: "A city, a month, who is coming, and what the days should feel like. Safar names the trip and answers in plain words.",
  },
  {
    kicker: "The days",
    title: "A plan with room to wander.",
    body: "Four days, in order, with the long lunch left open. You can change a day without starting over.",
  },
  {
    kicker: "Stay",
    title: "A room that fits the reason you went.",
    body: "Safar says why a stay made the cut. Booking.com and Airbnb open when you want to look — Safar never takes the payment.",
  },
  {
    kicker: "Dinner",
    title: "The table, already chosen.",
    body: "Somewhere close, open that evening, with the reason in one line. Zomato opens from the card.",
  },
  {
    kicker: "Saved",
    title: "The trip stays on your phone.",
    body: "Days, stays, and notes live on this device. Share the plan as text when someone else is coming.",
  },
];

const POCKET = [
  { who: "you", text: "Coorg this weekend. Just me. I want it quiet." },
  { who: "safar", text: "Saturday and Sunday. I’ll keep you in the coffee hills, not on the highway." },
  { who: "card", title: "Verandah stay", text: "The walk into the trees is the morning." },
  { who: "you", text: "Remind me when to leave." },
  { who: "safar", text: "Friday at 4. The road is kinder then, and you still get the light." },
];

export function Site() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Safar — Know the trip before you go";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="site">
      <a className="site-skip" href="#product">
        Skip to the product
      </a>
      <Flight />
      <Header />
      <Hero />
      <Theater />
      <Pocket />
      <Close />
      <Footer />
    </div>
  );
}

function Flight() {
  const flightRef = useRef(null);
  const planeRef = useRef(null);

  useEffect(() => {
    const flight = flightRef.current;
    const plane = planeRef.current;
    const site = flight?.closest(".site");
    if (!flight || !plane || !site) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      plane.style.opacity = "0";
      return undefined;
    }

    let frame = 0;
    const draw = () => {
      const w = site.offsetWidth;
      const viewH = window.innerHeight;
      const max = Math.max(1, document.documentElement.scrollHeight - viewH);
      if (w < 2) return;
      const mark = site.querySelector(".site-bar .site-mark");
      const box = mark?.getBoundingClientRect();
      const origin = box
        ? { x: box.left + box.width * 0.72, y: box.top + box.height / 2 }
        : { x: Math.min(180, w * 0.2), y: 88 };
      const progress = Math.min(1, Math.max(0, window.scrollY / max));
      const here = flightPoint(progress, w, viewH, origin);
      const next = flightPoint(Math.min(1, progress + 0.012), w, viewH, origin);
      const angle = (Math.atan2(next.y - here.y, next.x - here.x) * 180) / Math.PI;
      plane.style.transform = `translate(${here.x}px, ${here.y}px) rotate(${angle}deg)`;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(site);
    window.addEventListener("scroll", schedule, { passive: true });
    document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
    };
  }, []);

  return (
    <div ref={flightRef} className="site-flight" aria-hidden="true">
      <div ref={planeRef} className="site-flight-plane">
        <div className="site-flight-bob">
          <svg viewBox="0 0 100 64">
            <polygon points="50,32 8,8 16,6 54,28" fill="#c4a574" />
            <polygon points="50,32 8,56 16,58 54,36" fill="#c4a574" />
            <polygon points="26,32 76,26 98,32 76,38" fill="#171512" />
            <polygon points="32,32 18,18 24,17 36,30 24,47 18,46" fill="#171512" />
            <polygon points="84,29 98,32 84,35" fill="#e4c48a" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function flightPoint(p, width, viewH, origin) {
  const weaveX = width * (0.5 + 0.3 * Math.sin(p * Math.PI * 4));
  const weaveY = viewH * (0.42 + 0.12 * Math.sin(p * Math.PI * 3 + 0.8));
  const leave = Math.min(1, p / 0.14);
  const ease = leave * leave * (3 - 2 * leave);
  const departX = Math.min(width * 0.78, origin.x + width * 0.42 * Math.min(1, p / 0.06));
  return {
    x: departX * (1 - ease) + weaveX * ease,
    y: origin.y * (1 - ease) + weaveY * ease,
  };
}

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <div className="site-announcement">
        <span>New</span>
        <a href="#product">Safar is on the web</a>
      </div>
      <div className="site-bar">
        <Link to="/" className="site-mark" aria-label="Safar, home">
          Safar
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <a href="#product">Product</a>
          <a href="#pocket">Before you go</a>
          <Link to="/privacy">Privacy</Link>
        </nav>
        <div className="site-bar-actions">
          <Link to="/try" className="site-pill site-pill-live">
            <PillStars />
            <span>Try Safar</span>
            <Plane />
          </Link>
          <button
            type="button"
            className="site-menu"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
      {open ? (
        <nav className="site-drawer" aria-label="Mobile">
          <a href="#product" onClick={() => setOpen(false)}>
            Product
          </a>
          <a href="#pocket" onClick={() => setOpen(false)}>
            Before you go
          </a>
          <Link to="/privacy" onClick={() => setOpen(false)}>
            Privacy
          </Link>
          <Link to="/try" className="site-pill site-pill-live" onClick={() => setOpen(false)}>
            <PillStars />
            <span>Try Safar</span>
            <Plane />
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

const ASK = "Udaipur in December. Two of us. Rooftops, the lake, and one long lunch.";

function Hero() {
  return (
    <section className="site-hero">
      <p className="site-kicker">Private AI travel concierge</p>
      <h1>
        Know the trip
        <br />
        <span className="site-hero-line">
          before you go
          <Compass />
        </span>
      </h1>
      <p className="site-lede">
        Ask for a city, a weekend, or a month away. Safar comes back with the days, a place to stay, where to eat, and what is worth the walk.
      </p>
      <div className="site-cta-row">
        <a className="site-cta site-pill-live" href={PLAY_STORE_URL}>
          <PillStars />
          <span>Get the app</span>
          <Plane />
        </a>
      </div>
      <p className="site-fine">
        Plans stay on your phone. Stays, tables, and the way there open in the site or app that books them.
      </p>
      <Film />
      <a className="site-down" href="#product">
        <span>See a trip take shape</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>
    </section>
  );
}

function Film() {
  const [beat, setBeat] = useState(0);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setBeat(6);
      setTyped("");
      return undefined;
    }
    let alive = true;
    const wait = (ms) => new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
    const play = async () => {
      while (alive) {
        setBeat(0);
        setTyped("");
        for (let i = 1; i <= ASK.length; i += 1) {
          if (!alive) return;
          setTyped(ASK.slice(0, i));
          await wait(26);
        }
        if (!alive) return;
        setBeat(1);
        await wait(420);
        if (!alive) return;
        setTyped("");
        setBeat(2);
        await wait(900);
        if (!alive) return;
        setBeat(3);
        await wait(1500);
        if (!alive) return;
        setBeat(4);
        await wait(1500);
        if (!alive) return;
        setBeat(5);
        await wait(1500);
        if (!alive) return;
        setBeat(6);
        await wait(2200);
      }
    };
    play();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="site-film" aria-hidden="true">
      <div className="site-film-chrome">
        <span />
        <span />
        <span />
        <p>safarfoundation.com</p>
      </div>
      <div className="site-film-app">
        <div className="site-film-bar">
          <span>Safar</span>
          <span>Udaipur · December</span>
        </div>
        <div className="site-film-thread">
          {beat >= 1 ? (
            <p className="site-film-you" key={`you-${beat < 2 ? "send" : "sent"}`}>{ASK}</p>
          ) : null}
          {beat === 2 ? (
            <p className="site-film-typing" key="typing">
              <i />
              <i />
              <i />
            </p>
          ) : null}
          {beat >= 3 ? (
            <p className="site-film-safar" key="reply">
              <strong>Four nights, 12–16 December.</strong>
              I’ll keep the days slow and the evenings on the water.
            </p>
          ) : null}
          {beat >= 4 ? (
            <ol className="site-film-days" key="days">
              <li><span>Day 1</span> Arrive. A short walk once the bags are down.</li>
              <li><span>Day 2</span> Lake Pichola as the light goes.</li>
              <li><span>Day 3</span> A lunch that is allowed to take the afternoon.</li>
            </ol>
          ) : null}
          {beat >= 5 ? (
            <article className="site-film-card" key="stay">
              <p>Safar’s note</p>
              <h3>A haveli facing the lake</h3>
              <span>Opens on Booking.com</span>
            </article>
          ) : null}
          {beat >= 6 ? (
            <article className="site-film-card" key="dinner">
              <p>Tonight</p>
              <h3>Rooftop thali, six minutes away</h3>
              <span>Opens in Zomato · saved on this phone</span>
            </article>
          ) : null}
        </div>
        <div className="site-film-compose">
          <p>{typed || (beat === 0 ? "" : "Ask for another day")}<i /></p>
          <span>Send</span>
        </div>
        <div className={`site-film-cursor is-${beat}`}>
          <svg viewBox="0 0 16 16">
            <path d="M2 1.2 13.2 8.2 7.4 9.2 5.6 14.4Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Compass() {
  return (
    <svg className="site-compass" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" />
      <circle cx="32" cy="32" r="3" />
      <path d="M32 8l6 20-6 4-6-4 6-20z" />
      <path className="site-compass-south" d="M32 56l-6-20 6-4 6 4-6 20z" />
    </svg>
  );
}

function PillStars() {
  return (
    <span className="site-pill-stars" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function Plane() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 11.5 21 4l-7.2 16-2.2-6.2L3 11.5z" />
    </svg>
  );
}

function Theater() {
  const ref = useRef(null);
  const lock = useRef(false);
  const [active, setActive] = useState(0);
  const [compact, setCompact] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 860px)");
    const apply = () => setCompact(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (compact) return undefined;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (lock.current) return;
        const el = ref.current;
        if (!el) return;
        const total = el.offsetHeight - window.innerHeight;
        if (total <= 0) return;
        const passed = Math.min(Math.max(-el.getBoundingClientRect().top, 0), total - 1);
        const next = Math.min(STEPS.length - 1, Math.floor((passed / total) * STEPS.length));
        setActive((current) => (current === next ? current : next));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [compact]);

  useEffect(() => {
    if (!compact || touched) return undefined;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % STEPS.length);
    }, 4600);
    return () => window.clearInterval(id);
  }, [compact, touched]);

  const go = (index) => {
    setActive(index);
    setTouched(true);
    if (compact) return;
    const el = ref.current;
    if (!el) return;
    const total = el.offsetHeight - window.innerHeight;
    const top = window.scrollY + el.getBoundingClientRect().top + (total * (index + 0.45)) / STEPS.length;
    lock.current = true;
    window.scrollTo({ top, behavior: "smooth" });
    window.setTimeout(() => {
      lock.current = false;
    }, 800);
  };

  return (
    <section className="site-theater" id="product" ref={ref}>
      <div className="site-stage">
        <div className="site-stage-copy">
          <p className="site-kicker">On the web</p>
          <h2>Your whole trip, in one conversation.</h2>
          <div className="site-steps" role="tablist" aria-label="What Safar does">
            {STEPS.map((step, index) => {
              const on = index === active;
              return (
                <button
                  key={step.kicker}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={on ? "is-on" : ""}
                  onClick={() => go(index)}
                >
                  <span className="site-step-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="site-step-copy">
                    <span className="site-step-kicker">{step.kicker}</span>
                    <span className="site-step-title">
                      <span>{step.title}</span>
                    </span>
                    <span className="site-step-body">
                      <span>{step.body}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="site-frame" aria-live="polite">
          <div className="site-frame-bar">
            <span>Safar</span>
            <span>Udaipur · December</span>
          </div>
          <Scene index={active} />
        </div>
      </div>
    </section>
  );
}

function Scene({ index }) {
  if (index === 1) return <DaysScene />;
  if (index === 2) return <StayScene />;
  if (index === 3) return <DinnerScene />;
  if (index === 4) return <SavedScene />;
  return <AskScene />;
}

function AskScene() {
  return (
    <div className="site-scene" key="ask">
      <p className="site-ghost">Udaipur</p>
      <div className="site-bubble site-bubble-you">
        Udaipur in December. Two of us. Rooftops, the lake, and one long lunch.
      </div>
      <div className="site-bubble site-bubble-safar">
        <strong>Four nights, 12–16 December.</strong>
        I’ll keep the days slow and the evenings on the water.
      </div>
    </div>
  );
}

function DaysScene() {
  const days = [
    ["Day 1", "Arrive. A short walk once the bags are down."],
    ["Day 2", "Lake Pichola as the light goes."],
    ["Day 3", "A lunch that is allowed to take the afternoon."],
    ["Day 4", "The lanes, then the evening train."],
  ];
  return (
    <div className="site-scene" key="days">
      <p className="site-scene-label">The shape of it</p>
      <ol className="site-days">
        {days.map(([day, line]) => (
          <li key={day}>
            <span>{day}</span>
            <p>{line}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StayScene() {
  return (
    <div className="site-scene" key="stay">
      <article className="site-stay">
        <Lake />
        <div>
          <p className="site-scene-label">Safar’s note</p>
          <h3>A haveli facing the lake</h3>
          <p>You asked for the water, not a lobby. Quiet room, a terrace, City Palace across the lake.</p>
          <p className="site-partner">Opens on Booking.com</p>
        </div>
      </article>
    </div>
  );
}

function Lake() {
  return (
    <svg className="site-lake" viewBox="0 0 640 280" aria-hidden="true">
      <rect width="640" height="280" fill="#10151f" />
      <circle cx="508" cy="58" r="16" fill="#e4c48a" />
      <path d="M70 176 V132 h28 v-22 h14 v22 h70 v-36 h18 v36 h46 V176 Z" fill="#c4a574" />
      <path d="M118 110 h8 v-28 h-8 Z" fill="#e4c48a" />
      <path d="M0 176 H640 V280 H0 Z" fill="#182433" />
      <path d="M70 190 v28 h28 v-16 h14 v16 h70 v-22 h18 v22 h46 v-28 Z" fill="#0c121c" opacity="0.55" />
      <path d="M0 196 C 120 186, 220 214, 340 196 C 460 178, 540 208, 640 190 V 220 C 520 236, 400 206, 280 220 C 160 234, 80 208, 0 216 Z" fill="#10151f" opacity="0.55" />
    </svg>
  );
}

function DinnerScene() {
  return (
    <div className="site-scene" key="dinner">
      <p className="site-scene-label">Tonight</p>
      <article className="site-place is-pick">
        <div>
          <h3>Rooftop thali</h3>
          <p>Six minutes from the haveli. The one I’d pick for the first night.</p>
        </div>
        <span>Pick</span>
      </article>
      <article className="site-place">
        <div>
          <h3>Lakeside grill</h3>
          <p>Closer to the ghat, if you want the water in the conversation.</p>
        </div>
        <span>Also</span>
      </article>
      <p className="site-partner">Opens in Zomato</p>
    </div>
  );
}

function SavedScene() {
  return (
    <div className="site-scene" key="saved">
      <article className="site-ticket">
        <p>Saved on this phone</p>
        <h3>Udaipur</h3>
        <p>12–16 December · two travelers</p>
        <div>
          <span>4 days</span>
          <span>1 stay</span>
          <span>Share as text</span>
        </div>
      </article>
    </div>
  );
}

function Pocket() {
  const ref = useRef(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setPlay(true);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="site-pocket" id="pocket" ref={ref}>
      <div>
        <p className="site-kicker">Before you go</p>
        <h2>A nudge, while the trip is still ahead.</h2>
        <p className="site-lede">
          On the Android app, Safar can remind you the evening before a plan and the morning of it. You set the habit once. The phone does the rest.
        </p>
        <button
          type="button"
          className="site-replay"
          onClick={() => {
            setPlay(false);
            window.requestAnimationFrame(() => setPlay(true));
          }}
        >
          Play it again
        </button>
      </div>
      <div className={`site-phone${play ? " is-playing" : ""}`} aria-hidden={!play}>
        <div className="site-phone-top">
          <span>Safar</span>
          <span>Coorg</span>
        </div>
        <div className="site-thread">
          {POCKET.map((item, index) => (
            <div key={`${item.who}-${index}`} className={`site-msg site-msg-${item.who}`} style={{ "--i": index }}>
              {item.title ? <strong>{item.title}</strong> : null}
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Close() {
  return (
    <section className="site-close">
      <p className="site-kicker">Get started</p>
      <h2>Say where you want to be.</h2>
      <p>A beach week, a city you have saved for years, or dinner in a place you already know.</p>
      <div className="site-cta-row">
        <a className="site-cta site-pill-live" href={PLAY_STORE_URL}>
          <PillStars />
          <span>Get the app</span>
          <Plane />
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <p className="site-mark">Safar</p>
        <p>To help you know the trip before you go.</p>
      </div>
      <div>
        <p>Product</p>
        <a href="#product">A conversation</a>
        <a href="#pocket">Before you go</a>
        <a href={PLAY_STORE_URL}>Get the app</a>
      </div>
      <div>
        <p>Legal</p>
        <Link to="/privacy">Privacy policy</Link>
      </div>
      <p className="site-footer-note">
        Safar plans the trip and opens partner sites for stays and tables. It does not take hotel payment. © {new Date().getFullYear()} Safar
      </p>
    </footer>
  );
}
