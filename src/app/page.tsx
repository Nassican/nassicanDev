import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Skills from "@/components/sections/Skills";
import Experience from "@/components/sections/Experience";
import Education from "@/components/sections/Education";
import Projects from "@/components/sections/Projects";

export default function Home() {
  return (
    <main className="mx-auto max-w-full">
      <Hero />
      <About />
      <Skills />
      <Experience />
      <Education />
      <Projects />
    </main>
  );
}
