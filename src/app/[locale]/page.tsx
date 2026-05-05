import { Navbar } from "@/components/sections/navbar";
import { Hero } from "@/components/sections/hero";
import { HeroMarquee } from "@/components/sections/hero-marquee";
import { Services } from "@/components/sections/services";
import { HeroBlobs } from "@/components/ui/hero-blobs";
import { WhyUs } from "@/components/sections/why-us";
import { About } from "@/components/sections/about";
import { Principles } from "@/components/sections/principles";
import { Faq } from "@/components/sections/faq";
import { CtaBanner } from "@/components/sections/cta-banner";
import { Contact } from "@/components/sections/contact";
import { Location } from "@/components/sections/location";
import { Footer } from "@/components/sections/footer";
import { WhatsappFloat } from "@/components/ui/whatsapp-float";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="relative overflow-hidden">
          <HeroBlobs />
          <Hero />
        </div>
        <HeroMarquee />
        <div className="relative overflow-hidden">
          <Services />
        </div>
        <WhyUs />
        <About />
        <Principles />
        <Faq />
        <CtaBanner />
        <Contact />
        <Location />
      </main>
      <Footer />
      <WhatsappFloat />
    </>
  );
}
