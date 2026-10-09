import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  normalizeSource,
  OTHER,
  OTHER_MAX,
  otherKey,
  surveyQuestions,
  toggleMulti,
  type ChoiceQuestion,
  type SurveyAnswers,
  type SurveySource,
  type TextQuestion,
} from '../../data/survey';
import { markSurveyDone, newSessionId, submitSurvey, surveyDone, trackStep } from '../../lib/survey';
import { routes } from '../../routes';
import { Wordmark } from '../marks';

/** 0 = intro, 1–7 = question n, 'done' = thank-you. */
type Screen = number | 'done';

interface Saved {
  session: string;
  screen: number;
  answers: SurveyAnswers;
  source: SurveySource;
}

const DRAFT_KEY = 'omc:v1:survey:draft';
const TOTAL = surveyQuestions.length;
/** Long enough to see the tap land, short enough not to wait. */
const ADVANCE_MS = 220;

function readDraft(): Saved | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function writeDraft(d: Saved | null) {
  try {
    if (d) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* a reload would start over; nothing else depends on it */
  }
}

/**
 * The customer discovery survey: one question per screen, big tap targets.
 * Single-choice questions move on by themselves; multi-choice ones wait for
 * Continue. Back (on screen or the browser's) keeps every answer. Answers stay
 * in this tab until she sends them; only how far she got is reported before that.
 */
export default function Survey() {
  const [screen, setScreen] = useState<Screen>(0);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [already, setAlready] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const session = useRef('');
  const source = useRef<SurveySource>('direct');
  const tracked = useRef(-1);
  const honeypot = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const advanceTimer = useRef<number | undefined>(undefined);
  const firstRender = useRef(true);
  /** The screen this tab's history starts at; Back below it can't use the browser's history. */
  const base = useRef(0);

  // Restore a draft (reload mid-survey) or recognize a finished one.
  useEffect(() => {
    if (surveyDone()) {
      setAlready(true);
      setScreen('done');
      return;
    }
    const draft = readDraft();
    session.current = draft?.session ?? newSessionId();
    source.current = draft?.source ?? normalizeSource(new URLSearchParams(location.search).get('source'));
    if (draft) {
      tracked.current = draft.screen;
      setAnswers(draft.answers);
      setScreen(draft.screen);
    }
    base.current = draft?.screen ?? 0;
    history.replaceState({ survey: base.current }, '');
    const onPop = (e: PopStateEvent) => {
      window.clearTimeout(advanceTimer.current);
      const s = e.state?.survey;
      setScreen((cur) => (cur === 'done' ? cur : typeof s === 'number' ? s : 0));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Report progress (starts and drop-off), keep the draft, move focus to the new question.
  useEffect(() => {
    if (screen === 'done' || !session.current) return;
    if (screen > tracked.current) {
      tracked.current = screen;
      trackStep(session.current, screen, source.current);
    }
    writeDraft({ session: session.current, screen, answers, source: source.current });
  }, [screen, answers]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    headingRef.current?.focus();
  }, [screen]);

  const go = (next: number) => {
    window.clearTimeout(advanceTimer.current);
    setError('');
    history.pushState({ survey: next }, '');
    setScreen(next);
  };

  const back = () => {
    window.clearTimeout(advanceTimer.current);
    if (typeof screen !== 'number') return;
    if (screen > base.current) {
      history.back();
    } else {
      // Resumed mid-survey after a reload: no earlier entry to go back to.
      base.current = screen - 1;
      history.replaceState({ survey: base.current }, '');
      setScreen(base.current);
    }
  };

  const send = async (withText: boolean) => {
    if (sending) return;
    setSending(true);
    setError('');
    const final = withText ? answers : { ...answers, q7: undefined };
    const result = await submitSurvey(session.current, final, honeypot.current?.value ?? '', source.current);
    setSending(false);
    if (result === 'ok' || result === 'rate_limited') {
      markSurveyDone();
      writeDraft(null);
      history.replaceState({ survey: 'done' }, '');
      setScreen('done');
      return;
    }
    setError('That didn’t send. Check your connection and try again — your answers are still here.');
  };

  const question = typeof screen === 'number' && screen > 0 ? surveyQuestions[screen - 1] : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-1 bg-month" aria-hidden="true" />
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pt-[env(safe-area-inset-top)] sm:px-6">
        <header className="flex h-14 shrink-0 items-center border-b border-rule">
          <Wordmark badge="size-8" />
        </header>

        {screen === 0 && <Intro headingRef={headingRef} onStart={() => go(1)} />}

        {question && (
          <section className="flex flex-1 flex-col" aria-labelledby="survey-q">
            <div className="flex items-center justify-between pt-3">
              <button type="button" onClick={back} className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-[3px] px-2 text-[0.95rem] font-semibold">
                <span aria-hidden="true">←</span> Back
              </button>
              <p className="label text-soft">
                Question {screen} of {TOTAL}
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-band" aria-hidden="true">
              <div className="h-full rounded-full bg-ink" style={{ width: `${((screen as number) / TOTAL) * 100}%` }} />
            </div>

            <h1 id="survey-q" ref={headingRef} tabIndex={-1} className="mt-6 text-[1.4rem] leading-[1.25] font-bold text-balance outline-none min-[390px]:text-[1.5rem]">
              {question.prompt}
            </h1>

            {question.kind === 'text' ? (
              <OpenText
                question={question}
                value={answers.q7 ?? ''}
                onChange={(v) => setAnswers((a) => ({ ...a, q7: v }))}
                onSend={() => send(true)}
                onSkip={() => send(false)}
                sending={sending}
                error={error}
                honeypot={honeypot}
              />
            ) : (
              <Choices
                key={question.id}
                question={question}
                value={answers[question.id]}
                otherText={answers[otherKey(question.id)] ?? ''}
                onOtherText={(v) => setAnswers((a) => ({ ...a, [otherKey(question.id)]: v }))}
                onSingle={(id) => {
                  setAnswers((a) => ({ ...a, [question.id]: id }));
                  window.clearTimeout(advanceTimer.current);
                  // "Something else" waits, so there's a moment to say what (optional).
                  if (id !== OTHER) advanceTimer.current = window.setTimeout(() => go((screen as number) + 1), ADVANCE_MS);
                }}
                onMulti={(ids) => setAnswers((a) => ({ ...a, [question.id]: ids }))}
                onContinue={() => go((screen as number) + 1)}
              />
            )}
          </section>
        )}

        {screen === 'done' && <Done headingRef={headingRef} already={already} />}
      </div>
    </div>
  );
}

function Intro({ headingRef, onStart }: { headingRef: React.RefObject<HTMLHeadingElement | null>; onStart: () => void }) {
  return (
    <section className="flex flex-1 flex-col">
      <div className="flex-1 pt-10 pb-8">
        <p className="label text-soft">A quick question or seven</p>
        <h1 ref={headingRef} tabIndex={-1} className="page-title mt-3 text-balance outline-none">
          Help us make family life a little easier.
        </h1>
        <p className="lede mt-5">We’re building tools to help moms manage schedules, cleaning, and everything in between.</p>
        <p className="lede mt-4">Tell us what actually happens in your home. No perfect answers needed.</p>
        <p className="mt-6 inline-flex items-center gap-2 border-l-[3px] border-month pl-3 text-[0.95rem] font-semibold">Takes about 2 minutes.</p>
      </div>
      <BottomBar>
        <button type="button" onClick={onStart} className="btn-primary min-h-14 w-full text-[0.8rem]">
          Let’s do it
        </button>
        <p className="mt-2 text-center text-[0.8rem] text-soft">No account. No email needed.</p>
      </BottomBar>
    </section>
  );
}

interface ChoicesProps {
  question: ChoiceQuestion;
  value: string | string[] | undefined;
  otherText: string;
  onOtherText: (v: string) => void;
  onSingle: (id: string) => void;
  onMulti: (ids: string[]) => void;
  onContinue: () => void;
}

function Choices({ question, value, otherText, onOtherText, onSingle, onMulti, onContinue }: ChoicesProps) {
  const multi = question.kind === 'multi';
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const hintId = `${question.id}-hint`;
  // Single choice moves on by itself, except after "Something else" (it shows its text field and waits).
  const showContinue = multi || selected.includes(OTHER);
  // Bring the field into view above the Continue bar when it appears, without opening the keyboard.
  const revealOther = (el: HTMLInputElement | null) => {
    if (el && !el.dataset.shown) {
      el.dataset.shown = '1';
      el.scrollIntoView({ block: 'center' });
    }
  };

  return (
    <>
      <p id={hintId} className="mt-2 text-[0.95rem] text-soft">
        {multi ? 'Choose all that apply.' : 'Choose one.'}
      </p>
      <div role="group" aria-labelledby="survey-q" aria-describedby={hintId} className="mt-5 flex-1 space-y-2.5 pb-6">
        {question.options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <div key={o.id}>
              <button
                type="button"
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={on}
                onClick={() => (multi ? onMulti(toggleMulti(question, selected, o.id)) : onSingle(o.id))}
                className={`flex min-h-15 w-full items-center gap-3.5 rounded-[10px] border-[1.5px] px-4 py-3 text-left text-[1.0625rem] leading-snug ${
                  on ? 'border-ink bg-month/20 font-semibold' : 'border-rule-strong/60 bg-paper hover:border-ink active:bg-band'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-6 shrink-0 place-items-center border-[1.5px] border-ink ${multi ? 'rounded-[6px]' : 'rounded-full'} ${on ? 'bg-ink' : 'bg-paper'}`}
                >
                  {on &&
                    (multi ? (
                      <svg viewBox="0 0 16 16" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 8.5l3.2 3L13 4.5" />
                      </svg>
                    ) : (
                      <span className="size-2.5 rounded-full bg-white" />
                    ))}
                </span>
                <span className="min-w-0 flex-1">{o.label}</span>
              </button>
              {o.id === OTHER && on && (
                <input
                  ref={revealOther}
                  type="text"
                  value={otherText}
                  onChange={(e) => onOtherText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onContinue();
                    }
                  }}
                  maxLength={OTHER_MAX}
                  enterKeyHint="next"
                  autoComplete="off"
                  aria-label="Something else: what is it? (optional)"
                  placeholder="What is it? (optional)"
                  className="mt-2 block min-h-12 w-full rounded-[10px] border-[1.5px] border-rule-strong/60 bg-paper px-4 text-[1.0625rem] placeholder:text-soft focus:border-ink focus:outline-none"
                />
              )}
            </div>
          );
        })}
      </div>
      {showContinue && (
        <BottomBar>
          <button type="button" onClick={onContinue} disabled={selected.length === 0} className="btn-primary min-h-14 w-full text-[0.8rem] disabled:bg-rule-strong/50 disabled:text-white">
            Continue
          </button>
          {multi && (
            <p className="mt-2 text-center text-[0.8rem] text-soft" aria-live="polite">
              {selected.length === 0 ? 'Pick at least one.' : `${selected.length} selected`}
            </p>
          )}
        </BottomBar>
      )}
    </>
  );
}

interface OpenTextProps {
  question: TextQuestion;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onSkip: () => void;
  sending: boolean;
  error: string;
  honeypot: React.RefObject<HTMLInputElement | null>;
}

function OpenText({ question, value, onChange, onSend, onSkip, sending, error, honeypot }: OpenTextProps) {
  const left = question.maxLength - value.length;
  return (
    <>
      <p id="q7-hint" className="mt-2 text-[0.95rem] text-soft">
        Optional. Skip it if nothing comes to mind.
      </p>
      <div className="flex-1 pt-5 pb-6">
        <label htmlFor="q7" className="sr-only">
          Your answer (optional)
        </label>
        <textarea
          id="q7"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={question.maxLength}
          rows={5}
          aria-describedby="q7-hint"
          placeholder={question.placeholder}
          className="block w-full rounded-[10px] border-[1.5px] border-rule-strong/60 bg-paper px-4 py-3 text-[1.0625rem] leading-relaxed placeholder:text-soft focus:border-ink focus:outline-none"
        />
        {left < 150 && <p className="mt-1.5 text-right text-[0.8rem] text-soft tabular-nums">{left} characters left</p>}
        {/* Hidden from people; bots that fill every field give themselves away. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input ref={honeypot} id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        {error && (
          <p role="alert" className="mt-4 border-l-[3px] border-ink bg-band px-3.5 py-2.5 text-[0.95rem] font-semibold">
            {error}
          </p>
        )}
      </div>
      <BottomBar>
        <button type="button" onClick={onSend} disabled={sending || !value.trim()} className="btn-primary min-h-14 w-full text-[0.8rem] disabled:bg-rule-strong/50 disabled:text-white">
          {sending ? 'Sending…' : 'Send my answers'}
        </button>
        <button type="button" onClick={onSkip} disabled={sending} className="mt-1 min-h-12 w-full text-[0.95rem] font-semibold underline decoration-rule underline-offset-4">
          Skip and finish
        </button>
      </BottomBar>
    </>
  );
}

function Done({ headingRef, already }: { headingRef: React.RefObject<HTMLHeadingElement | null>; already: boolean }) {
  return (
    <section className="flex-1 pt-12 pb-12">
      <p className="label text-soft">{already ? 'Already received' : 'All done'}</p>
      <h1 ref={headingRef} tabIndex={-1} className="page-title mt-3 text-balance outline-none">
        Thank you! You just helped us make something better for real families.
      </h1>
      <p className="lede mt-5">Your answers will help shape what we build next.</p>
      <p className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
        <a href={routes.home} className="text-link">
          Back to the homepage
        </a>
        <a href={routes.calendar} className="text-link">
          Explore the calendar
        </a>
      </p>
    </section>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-5 shrink-0 border-t border-rule bg-paper px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
      {children}
    </div>
  );
}
