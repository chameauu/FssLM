import { Link } from 'react-router-dom'
import SmartNotes from "../components/Tools/SmartNotes"
import PodcastGenerator from "../components/Tools/PodcastGenerator"
import Transcriber from "../components/Tools/Transcriber"

export default function Tools() {
  return (
    <div className="min-h-screen w-full px-4 lg:pl-28 lg:pr-4">
      <div className="max-w-6xl mx-auto pt-6 px-4 pb-14">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              to='/'
              className="p-2 rounded-xl bg-stone-950 border border-zinc-800 hover:bg-stone-900 transition-colors"
              aria-label="Back"
            >
              <svg viewBox="0 0 24 24" className="size-5 text-stone-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </Link>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-3">Tools</h1>
          </div>
          <div className="px-3 py-1 rounded-full bg-gradient-to-r from-sky-500/20 to-blue-500/20 border border-sky-500/30 text-sky-300 text-xs font-medium">
            BETA
          </div>
        </div>

        <div className="grid gap-6 mb-12">
          {/* Flashcard Generator Card */}
          <Link to="/flashcard-generator" className="group rounded-2xl bg-stone-950 border border-zinc-800 p-4 hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 block">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-xs uppercase tracking-wide text-blue-400 font-semibold">study tool</div>
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 animate-pulse"></div>
                </div>
                <div className="text-white font-semibold text-xl mb-2 flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-6 text-blue-400">
                    <path d="M3 5.25V3.75A2.25 2.25 0 0 1 5.25 1.5h13.5A2.25 2.25 0 0 1 21 3.75v16.5A2.25 2.25 0 0 1 18.75 22.5H5.25A2.25 2.25 0 0 1 3 20.25V5.25Z" />
                  </svg>
                  Flashcard Generator
                </div>
                <div className="text-stone-300 text-sm leading-relaxed">
                  Upload documents and generate AI-powered flashcards with advanced pedagogical techniques. Perfect for active recall and spaced repetition.
                </div>
              </div>
              <svg viewBox="0 0 24 24" className="size-5 text-stone-500 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <span className="px-2 py-1 rounded-lg bg-blue-900/30 border border-blue-800/50 text-xs text-blue-300">Document Upload</span>
              <span className="px-2 py-1 rounded-lg bg-purple-900/30 border border-purple-800/50 text-xs text-purple-300">8-12 Cards</span>
              <span className="px-2 py-1 rounded-lg bg-pink-900/30 border border-pink-800/50 text-xs text-pink-300">Diverse Types</span>
              <span className="px-2 py-1 rounded-lg bg-indigo-900/30 border border-indigo-800/50 text-xs text-indigo-300">Anti-Rote Learning</span>
            </div>
          </Link>

          <SmartNotes />
          <PodcastGenerator />
          <Transcriber />
        </div>
      </div>
    </div>
  )
}