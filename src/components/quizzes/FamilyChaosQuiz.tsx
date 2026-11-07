import { useEffect, useState } from 'react';
import { quizQuestions, quizResults, scoreQuiz, type Focus } from '../../data/family-chaos-quiz';

export default function FamilyChaosQuiz() {
  const [step,setStep]=useState(-1);
  const [answers,setAnswers]=useState<Focus[]>([]);
  const [complete,setComplete]=useState(false);
  const [checked,setChecked]=useState<boolean[]>([false,false,false]);
  const [copied,setCopied]=useState(false);
  const result=complete?quizResults[scoreQuiz(answers)]:null;
  const question=quizQuestions[step];
  useEffect(()=>{if(typeof window==='undefined')return;const saved=sessionStorage.getItem('omc-family-chaos-quiz');if(!saved)return;try{const data=JSON.parse(saved);if(Array.isArray(data.answers)&&data.answers.every((x:unknown)=>['routines','spaces','ownership','connection'].includes(String(x)))&&Number.isInteger(data.step)&&data.step>=-1&&data.step<quizQuestions.length){setAnswers(data.answers.slice(0,quizQuestions.length));setStep(data.step);setComplete(Boolean(data.complete)&&data.answers.length===quizQuestions.length)}}catch{}},[]);
  useEffect(()=>{if(typeof window!=='undefined')sessionStorage.setItem('omc-family-chaos-quiz',JSON.stringify({step,answers,complete}));},[step,answers,complete]);
  function answer(focus:Focus){const next=[...answers.slice(0,step),focus];setAnswers(next);if(step===quizQuestions.length-1){setComplete(true);setChecked([false,false,false]);}else setStep(step+1)}
  function restart(){setStep(-1);setAnswers([]);setComplete(false);setChecked([false,false,false]);setCopied(false)}
  async function share(){if(!result)return;const message=`My family organization starting point: ${result.title}. Find yours: https://www.organizedmomcollective.com/quizzes/family-chaos/`;try{if(navigator.share){await navigator.share({title:'My family organization starting point',text:message,url:'https://www.organizedmomcollective.com/quizzes/family-chaos/'});}else{await navigator.clipboard.writeText(message);setCopied(true)}}catch{}}
  const card='rounded-2xl border border-[#ded7cf] bg-white p-4 text-left transition-all hover:border-[#7a9a92] hover:bg-[#f6f9f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3D6671]';
  return <div className="mx-auto w-full max-w-[760px] text-[#545454]">
    {!complete&&step===-1&&<section className="overflow-hidden rounded-[28px] border border-[#e5dbd2] bg-[#FBF7F1] shadow-sm">
      <div className="relative bg-[#CDDDE1] px-6 py-9 text-center sm:px-12 sm:py-12">
        <p className="text-xs font-bold tracking-[.17em] text-[#3D6671]">A LITTLE CLARITY FOR YOUR FAMILY</p>
        <div className="mx-auto mt-6 grid max-w-[320px] grid-cols-4 gap-3" aria-hidden="true">{['/assets/icons/ofc/guides/morning/backpack.png','/assets/icons/ofc/guides/responsibility/basket.png','/assets/icons/ofc/guides/responsibility/hands.png','/assets/icons/ofc/guides/responsibility/family.png'].map((x,i)=><div key={i} className="flex aspect-square items-center justify-center rounded-2xl border border-white/80 bg-white/75 p-2 shadow-sm"><img src={x} alt="" width={48} height={48} className="h-12 w-12 object-contain" /></div>)}</div>
        <h2 className="mt-7 font-serif text-[2.2rem] leading-[1.12] sm:text-[3.5rem]">What's really causing the chaos in your home?</h2>
        <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed">Answer 7 quick questions. Discover your family's biggest friction point and get a simple, personalized 3-day action plan.</p>
      </div>
      <div className="px-6 py-7 text-center sm:px-12">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-[#66615b]"><span>✓ About 90 seconds</span><span>✓ No signup required</span><span>✓ Free action plan</span></div>
        <button type="button" onClick={()=>setStep(0)} className="mt-6 min-h-14 w-full max-w-sm rounded-full bg-[#545454] px-7 py-3 text-base font-bold text-white hover:bg-[#3D6671] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3D6671]">Find my family's starting point →</button>
      </div>
    </section>}
    {!complete&&question&&<section className="rounded-[28px] border border-[#e5dbd2] bg-[#FBF7F1] px-5 py-7 shadow-sm sm:px-10 sm:py-10" aria-label="Family organization quiz">
      <div className="flex items-center justify-between text-xs font-semibold text-[#6b6863]"><span>QUESTION {step+1} OF {quizQuestions.length}</span><span>{Math.round(step/quizQuestions.length*100)}% complete</span></div>
      <div className="mt-3 flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={0} aria-valuemax={quizQuestions.length} aria-label="Quiz progress">{quizQuestions.map((_,i)=><div key={i} className={`h-2 flex-1 rounded-full transition-colors duration-300 ${i<step?'bg-[#7c9f95]':'bg-[#e0d9d0]'}`}/>)}</div>
      <p className="mt-9 text-center text-xs font-bold uppercase tracking-[.15em] text-[#3D6671]">{question.eyebrow}</p>
      <h2 tabIndex={-1} className="mx-auto mt-3 max-w-xl text-center font-serif text-[1.9rem] leading-tight sm:text-[2.7rem]">{question.prompt}</h2>
      {step===4&&<p className="mx-auto mt-4 max-w-lg rounded-xl bg-[#CDDDE1]/55 px-4 py-3 text-center text-sm leading-relaxed">You're more than halfway there. Your answers are helping narrow down a useful place to start.</p>}
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">{question.choices.map((choice,i)=><button key={choice.label} type="button" className={card+' flex min-h-[98px] items-center gap-4'} onClick={()=>answer(choice.focus)}><span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-transparent"><img src={choice.icon} alt="" width={48} height={48} className="h-12 w-12 object-contain" /></span><span className="block"><span className="block text-[0.95rem] font-bold leading-snug">{choice.label}</span>{choice.detail&&<span className="mt-1 block text-xs leading-snug text-[#77716b]">{choice.detail}</span>}</span></button>)}</div>
      <div className="mt-8 flex items-center justify-between"><button type="button" onClick={()=>setStep(s=>Math.max(-1,s-1))} className="min-h-11 rounded-full px-4 text-sm font-semibold underline underline-offset-4">← Back</button><span className="text-xs text-[#77716b]">Tap what feels most true. No wrong answers.</span></div>
    </section>}
    {complete&&result&&<section className="overflow-hidden rounded-[28px] border border-[#e5dbd2] bg-[#FBF7F1] shadow-sm" aria-live="polite">
      <div className="px-6 pb-8 pt-10 text-center sm:px-12" style={{background:result.color}}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/85 text-3xl" aria-hidden="true"><img src="/assets/icons/ofc/guides/responsibility/star.png" alt="" width={52} height={52} className="h-12 w-12 object-contain" /></div>
        <p className="mt-5 text-xs font-bold tracking-[.15em] text-[#545454]">YOUR FAMILY'S STARTING POINT</p>
        <h2 className="mt-3 font-serif text-[2.4rem] leading-tight sm:text-[3.3rem]">{result.title}</h2>
        <p className="mx-auto mt-3 max-w-lg text-lg font-medium leading-relaxed">{result.subtitle}</p>
      </div>
      <div className="space-y-8 px-5 py-8 sm:px-12 sm:py-10">
        <div><h3 className="font-serif text-2xl">What your answers suggest</h3><p className="mt-3 text-[0.97rem] leading-[1.85]">{result.explanation}</p><p className="mt-3 text-sm italic text-[#77716b]">This is a practical starting point based on your choices, not a judgment about your family.</p></div>
        <div className="rounded-2xl bg-white p-5 sm:p-7"><p className="text-xs font-bold tracking-widest text-[#3D6671]">YOUR FIRST MISSION</p><h3 className="mt-2 font-serif text-2xl">Your 3-day family reset</h3><p className="mt-2 text-sm leading-relaxed">{result.prompt}</p><div className="mt-5 space-y-3">{result.challenge.map((task,i)=><label key={i} className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#FBF7F1] p-3"><input type="checkbox" checked={checked[i]} onChange={()=>setChecked(old=>old.map((x,j)=>i===j?!x:x))} className="mt-1 h-5 w-5 accent-[#3D6671]"/><span className="text-sm leading-relaxed"><strong className="block">Day {i+1}</strong>{task}</span></label>)}</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e0d9d0]"><div className="h-full rounded-full bg-[#8aa995] transition-all" style={{width:`${(checked.filter(Boolean).length/3)*100}%`}}/></div><p className="mt-2 text-xs font-semibold text-[#6f6a65]">{checked.every(Boolean)?'You did it! Keep the rhythm going.':`${checked.filter(Boolean).length} of 3 steps complete`}</p></div>
        <div className="border-t border-[#ded7cf] pt-7"><p className="text-xs font-bold tracking-widest text-[#3D6671]">A FREE GUIDE PICKED FOR YOU</p><h3 className="mt-2 font-serif text-2xl">{result.guide.label}</h3><p className="mt-2 text-sm leading-relaxed">{result.guide.description}</p><a href={result.guide.href} data-cta="quiz-primary-guide" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-[#545454] px-6 py-3 text-sm font-bold text-white hover:bg-[#3D6671]">Open your free guide →</a><p className="mt-4"><a className="text-sm font-semibold underline underline-offset-4" href={result.secondary.href} data-cta="quiz-secondary-tool">{result.secondary.label} →</a></p></div>
        <div className="rounded-2xl bg-[#D4DFC4]/60 p-5"><h3 className="font-serif text-xl">Want support making this a family habit?</h3><p className="mt-2 text-sm leading-relaxed">Organized Family Club helps families build simple rhythms together through personalized tools and monthly family meetings.</p><a href="/club" data-cta="quiz-club" className="mt-3 inline-block text-sm font-bold underline underline-offset-4">Explore Organized Family Club →</a></div>
        <div className="flex flex-wrap gap-3 border-t border-[#ded7cf] pt-6 print:hidden"><button type="button" onClick={()=>window.print()} className="min-h-11 rounded-full border border-[#545454] px-5 text-sm font-semibold">Print my action plan</button><button type="button" onClick={share} className="min-h-11 rounded-full border border-[#545454] px-5 text-sm font-semibold">{copied?'Link copied ✓':'Share my result'}</button><button type="button" onClick={restart} className="min-h-11 px-3 text-sm font-semibold underline underline-offset-4">Retake quiz</button></div>
        <p className="text-xs text-[#77716b] print:hidden">Your answers stay in this browser session. No account or email is required. Your result can be printed now; email delivery is not available yet.</p>
      </div>
    </section>}
  </div>;
}
