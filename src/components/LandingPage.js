"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Zap, Shield, Users, Upload, Calendar, CheckCircle,
  ChevronDown, CreditCard, Gift, Activity, Microscope, 
  FileText, HeartPulse, Stethoscope, ClipboardCheck
} from "lucide-react";
import { formatTrialLabel } from "@/lib/trial";
import { Logo, NotFoundState } from "@/components/ui/Shared";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";

function Textarea(props) {
  return (
    <textarea 
      {...props} 
      className={props.className || "h-32 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"} 
    />
  );
}

import { ShimmerCard } from "@/components/ui/Shimmer";
import { testimonials, faqs } from "@/lib/mock-data";
import { ROUTES } from "@/lib/constants";
import { usePublicPlans } from "@/hooks/usePlans";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

// Medical and Laboratory Features
const features = [
  { icon: Microscope, title: "Advanced Diagnostics", desc: "State-of-the-art pathology, hematology, and molecular diagnostics with pinpoint precision." },
  { icon: Shield, title: "ISO Certified & Secure", desc: "Fully automated, hands-free sample processing following strict international safety protocols." },
  { icon: FileText, title: "Instant Digital Reports", desc: "Access secure PDF lab records via SMS, WhatsApp, and our cloud patient portal." },
  { icon: Users, title: "Corporate & B2B Panels", desc: "Tailored executive health checks, pre-employment screenings, and home sampling management." },
];

// Workflow Steps for Patients/Clinics
const steps = [
  { icon: ClipboardCheck, title: "Book a Test or Panel", desc: "Select tests online, walk in, or choose our safe home sample collection service." },
  { icon: Activity, title: "Automated Processing", desc: "Barcoded samples are routed through barcode-scanned high-throughput analyzers." },
  { icon: FileText, title: "Verified Results Sent", desc: "Dual-verified diagnostics reviewed by lead pathologists are released to your app." },
];

export function LandingPage() {
  const [requestOpen, setRequestOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestForm, setRequestForm] = useState({ business: "", email: "", useCase: "" });
  const [openFaq, setOpenFaq] = useState(null);
  const { plans, loading: plansLoading, freeTrialDays } = usePublicPlans();

  const pricingGridClass =
    plans.length === 1
      ? "grid grid-cols-1 max-w-md mx-auto gap-6"
      : plans.length === 2
        ? "grid grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto gap-6"
        : "grid grid-cols-1 md:grid-cols-3 gap-6";

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 antialiased">
      {/* Nav */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-[#004d26]" />
            <span className="text-xl font-black tracking-tight text-slate-900 uppercase">Laboratory</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-[#004d26] transition-colors">Our Services</a>
            <a href="#how-it-works" className="hover:text-[#004d26] transition-colors">Lab Workflow</a>
            <a href="#pricing" className="hover:text-[#004d26] transition-colors">Health Packages</a>
            <a href="#faq" className="hover:text-[#004d26] transition-colors">Patient FAQ</a>
          </nav>
        <div className="flex items-center gap-3">
  <Link href="/login">
    <Button variant="ghost" size="sm" className="font-semibold text-[#004d26]">Portal Login</Button>
  </Link>
  <Button size="sm" className="bg-[#004d26] text-yellow-400 hover:bg-[#00361a]" onClick={() => setRequestOpen(true)}>Book Home Sampling</Button>
</div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white border-b border-slate-100">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/40 via-white to-white" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp}>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#004d26] text-xs font-bold border border-emerald-100/60">
                  <Shield className="w-3.5 h-3.5" /> ISO 15189 Certified Facility
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-100">
                  <Gift className="w-3.5 h-3.5" /> Launch Discount: {formatTrialLabel(freeTrialDays)}
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-tight tracking-tight">
                Accurate diagnostics,{" "}
                <span className="text-[#004d26]">trusted results.</span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-slate-500 max-w-lg leading-relaxed">
                Welcome to Laboratory. We deliver institutional-grade clinical testing, fully computerized pathology, and medical reporting with automated digital delivery.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="bg-[#004d26] text-yellow-400 hover:bg-[#00361a] font-bold shadow-md shadow-emerald-900/10" onClick={() => setRequestOpen(true)}>Request Lab Appointment</Button>
                <Button variant="outline" size="lg" className="border-slate-300 text-slate-700 font-semibold hover:bg-slate-50">View Test Directory</Button>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="rounded-2xl border border-slate-200/60 shadow-2xl overflow-hidden bg-white p-2">
                <Image
                  src="/lab.png"
                  alt="Laboratory automated clinical analysis machinery"
                  width={800}
                  height={500}
                  className="w-full aspect-[16/10] object-cover rounded-xl"
                  unoptimized
                />
              </div>
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-4 -left-4 bg-white rounded-xl border border-slate-100 shadow-xl p-4 hidden sm:block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">99.8% Accuracy Rating</p>
                    <p className="text-xs text-slate-400 font-medium">EQAS Quality Checked</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Comprehensive Diagnostic Services</h2>
            <p className="mt-3 text-slate-500 max-w-xl mx-auto font-medium">Our clinical laboratory operates around the clock using fully automated analyzer grids.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-6 hover:shadow-lg hover:bg-white hover:border-emerald-100 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-5 border border-emerald-100/50">
                  <f.icon className="w-6 h-6 text-[#004d26]" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Lab Workflow Section */}
      <section id="how-it-works" className="py-20 bg-slate-50/30 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Our Streamlined Testing Flow</h2>
            <p className="mt-3 text-slate-500 font-medium">How we safeguard sample extraction, tracking, and evaluation</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="text-center relative group"
              >
                <div className="relative inline-flex mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-[#004d26] text-yellow-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/10 group-hover:scale-105 transition-transform">
                    <s.icon className="w-8 h-8" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center border-2 border-white">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto leading-relaxed font-medium">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Health Packages / Pricing */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Preventative Health Packages</h2>
            <p className="mt-3 text-slate-500 font-medium">All health profiles include professional consultation and a {freeTrialDays}-day revision window.</p>
          </motion.div>
          {plansLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => <ShimmerCard key={i} lines={5} />)}
            </div>
          ) : plans.length === 0 ? (
            <NotFoundState
              icon={CreditCard}
              title="Test packages coming soon"
              description="Our biochemical board is configuring customized health panels. Contact us for custom profiles."
              action={<Button className="bg-[#004d26] text-yellow-400 hover:bg-[#00361a]" onClick={() => setRequestOpen(true)}>Inquire Panels</Button>}
            />
          ) : (
            <div className={pricingGridClass}>
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.id}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className={`rounded-xl border bg-white p-6 relative transition-all duration-300 ${plan.popular ? "border-[#004d26] shadow-xl ring-1 ring-emerald-800/10 scale-105" : "border-slate-200"}`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#004d26] text-yellow-400 text-xs font-bold tracking-wide uppercase">
                      Most Selected
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900">${plan.price}</span>
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">/{plan.cycle || "panel"}</span>
                  </div>
                  <ul className="mt-6 space-y-3 border-t border-slate-100 pt-5">
                    <li className="text-xs flex items-center gap-2 text-[#004d26] font-bold bg-emerald-50 p-2 rounded-lg">
<Gift className="w-4 h-4 shrink-0 text-[#004d26]" />Includes Free Pathologist Followup
                    </li>
                    <li className="text-sm font-medium text-slate-600 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#004d26] shrink-0" /> Up to {plan.pinQuota.toLocaleString()} Bio-Markers Included
                    </li>
                    <li className="text-sm font-medium text-slate-600 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#004d26] shrink-0" /> Outpatient Consultation Notes
                    </li>
                    <li className="text-sm font-medium text-slate-600 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#004d26] shrink-0" /> Digital + Physical Smart Report
                    </li>
                  </ul>
                  <Button
                    type="button"
                    className="w-full mt-6 font-bold tracking-wide transition-all"
                    variant={plan.popular ? "default" : "outline"}
                    style={plan.popular ? {backgroundColor: "#004d26", color: "#facc15"} : {}}
                    onClick={() => setRequestOpen(true)}
                  >
                    Schedule Collection
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Patient Testimonials */}
      <section className="py-20 bg-slate-50/50 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Trusted by Doctors & Patients</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.author}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <p className="text-sm text-slate-600 italic leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3 pt-4 border-t border-slate-50">
                  <Image src={t.avatar} alt={t.author} width={40} height={40} className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100" unoptimized />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.author}</p>
                    <p className="text-xs font-semibold text-[#004d26] uppercase tracking-wider">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Patient FAQ */}
      <section id="faq" className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Frequently Asked Questions</h2>
          </motion.div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="rounded-xl border border-slate-200/60 bg-white overflow-hidden transition-colors duration-200"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left text-sm font-bold text-slate-800 hover:bg-slate-50/80 transition-colors"
                >
                  {faq.q}
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180 text-[#004d26]" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-slate-500 leading-relaxed font-medium bg-slate-50/30 border-t border-slate-50/50 pt-2">
                    {faq.a}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-900 text-slate-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-white">
            <HeartPulse className="w-5 h-5 text-emerald-400" />
            <span className="text-md font-extrabold tracking-wider uppercase">Laboratory</span>
          </div>
          <div className="flex gap-6 text-sm font-medium">
            <a href="#" className="hover:text-white transition-colors">Lab Guidelines</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Contact Pathologist</a>
          </div>
          <p className="text-xs font-medium text-slate-500">&copy; 2026 Laboratory Diagnostic Network. All rights reserved.</p>
        </div>
      </footer>

      {/* Home Sampling / Access Booking Modal */}
      <Modal open={requestOpen} onClose={() => { setRequestOpen(false); setSubmitted(false); }} title={submitted ? "Booking Request Received" : "Schedule Laboratory Home Sampling"}>
        {submitted ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="font-bold text-slate-900 text-lg">Phlebotomist Assignment Pending</p>
            <p className="text-sm text-slate-500 mt-2 font-medium">Our clinical scheduling desk will confirm your pickup slot over call within 15 minutes.</p>
            <Button className="mt-6 bg-[#004d26] text-yellow-400 hover:bg-[#00361a]" onClick={() => { setRequestOpen(false); setSubmitted(false); }}>Return To Home</Button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              try {
                const res = await fetch("/api/access-requests", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    business: requestForm.business,
                    email: requestForm.email,
                    useCase: requestForm.useCase,
                  }),
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error?.message || "Failed to submit request.");
                setSubmitted(true);
              } catch (err) {
                alert(err.message);
              } finally {
                setSubmitting(false);
              }
            }}
            className="space-y-4"
          >
            <Input label="Patient Full Name" placeholder="e.g. Muhammad Ali" value={requestForm.business} onChange={(e) => setRequestForm((f) => ({ ...f, business: e.target.value }))} required />
            <Input label="Contact Email Address" type="email" placeholder="patient@domain.com" value={requestForm.email} onChange={(e) => setRequestForm((f) => ({ ...f, email: e.target.value }))} required />
            <Textarea label="List Test Names / Medical History Remarks" placeholder="Please list required profiles (e.g. CBC, Lipid Profile, HbA1c) or specific instructions..." value={requestForm.useCase} onChange={(e) => setRequestForm((f) => ({ ...f, useCase: e.target.value }))} required rows={3} />
            <Button type="submit" className="w-full bg-[#004d26] text-yellow-400 hover:bg-[#00361a] font-bold" disabled={submitting}>{submitting ? "Processing Request..." : "Confirm Free Sampling Dispatch"}</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}