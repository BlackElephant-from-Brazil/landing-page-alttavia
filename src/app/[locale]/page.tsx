import { Navbar } from "@/components/sections/navbar";
import { Hero } from "@/components/sections/hero";
import { Versus } from "@/components/sections/versus";
import { Services } from "@/components/sections/services";
import { Process } from "@/components/sections/process";
import { BigStats } from "@/components/sections/big-stats";
import { About } from "@/components/sections/about";
import { WhyUs } from "@/components/sections/why-us";
import { Faq } from "@/components/sections/faq";
import { Contact } from "@/components/sections/contact";
import { Footer } from "@/components/sections/footer";
import { WhatsappFloat } from "@/components/ui/whatsapp-float";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Versus />
        <Services />
        <Process />
        <BigStats />
        <About />
        <WhyUs />
        <Faq />
        <Contact />
      </main>
      <Footer />
      <WhatsappFloat />
    </>
  );
}
