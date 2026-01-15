"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Copy, Calendar, Users, Target, MessageSquare, ClipboardList, Download, FileJson, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { compressAudio } from "@/lib/audio-processor";

interface MeetingData {
    title: string;
    date: string;
    participants: string[];
    summary: string;
    discussion: { topic: string; content: string }[];
    decisions: string[];
    actionItems: { task: string; assignee: string; due: string }[];
}

interface AnalysisResult {
    ko: MeetingData;
    en: MeetingData;
}

export default function Home() {
    const [file, setFile] = useState<File | null>(null);
    const [viewLang, setViewLang] = useState<"ko" | "en">("ko");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [reports, setReports] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const reportRef = useRef<HTMLDivElement>(null);

    const FILE_LIMIT_MB = 100;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setError(null);

            if (selectedFile.size > FILE_LIMIT_MB * 1024 * 1024) {
                setError(viewLang === 'ko'
                    ? `파일 크기가 ${FILE_LIMIT_MB}MB를 초과합니다. 더 짧거나 작은 분량의 파일을 선택해 주세요.`
                    : `File exceeds ${FILE_LIMIT_MB}MB. Please select a smaller or shorter recording.`);
            }
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsAnalyzing(true);
        setReports(null);
        setError(null);

        try {
            let fileToUpload: File | Blob = file;

            // Optional compression to save bandwidth
            setIsCompressing(true);
            try {
                const compressed = await compressAudio(file);
                if (compressed.size < file.size) {
                    fileToUpload = compressed;
                }
            } catch (compErr: any) {
                console.error("Compression skipped/failed:", compErr);
            } finally {
                setIsCompressing(false);
            }

            const formData = new FormData();
            formData.append("file", fileToUpload);

            const response = await fetch("/api/analyze", {
                method: "POST",
                body: formData,
            });

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "분석 중 오류가 발생했습니다.");
                }
                setReports(data);
            } else {
                const text = await response.text();
                throw new Error("서버 응답 오류가 발생했습니다. Render 배포 사양에 따라 대용량 처리가 가능하지만, 네트워크 환경을 확인해 주세요.");
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const formatFullReport = (data: MeetingData) => {
        let text = `[${data.title}]\n`;
        text += `Date: ${data.date}\n`;
        text += `Participants: ${data.participants.join(", ")}\n\n`;
        text += `Summary:\n${data.summary}\n\n`;

        text += `Discussion:\n`;
        data.discussion.forEach(item => {
            text += `- ${item.topic}: ${item.content}\n`;
        });

        text += `\nDecisions:\n`;
        data.decisions.forEach(item => {
            text += `- ${item}\n`;
        });

        text += `\nAction Items:\n`;
        data.actionItems.forEach(item => {
            text += `- [${item.assignee}] ${item.task} (Due: ${item.due})\n`;
        });

        return text;
    };

    const copyToClipboard = () => {
        if (reports) {
            const currentData = reports[viewLang];
            const text = formatFullReport(currentData);
            navigator.clipboard.writeText(text);
            alert(viewLang === 'ko' ? "전체 내용이 클립보드에 복사되었습니다." : "Full report copied to clipboard.");
        }
    };

    const exportToWord = async () => {
        if (!reports) return;
        setIsExporting("word");
        const data = reports[viewLang];

        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        text: data.title,
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Date: ${data.date}`, bold: true }),
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Participants: ${data.participants.join(", ")}`, italics: true }),
                        ],
                    }),
                    new Paragraph({ text: "" }),
                    new Paragraph({
                        text: "Summary",
                        heading: HeadingLevel.HEADING_2,
                    }),
                    new Paragraph({ text: data.summary }),
                    new Paragraph({ text: "" }),
                    new Paragraph({
                        text: "Discussion",
                        heading: HeadingLevel.HEADING_2,
                    }),
                    ...data.discussion.flatMap(item => [
                        new Paragraph({
                            children: [new TextRun({ text: item.topic, bold: true })],
                        }),
                        new Paragraph({ text: item.content }),
                    ]),
                    new Paragraph({ text: "" }),
                    new Paragraph({
                        text: "Decisions",
                        heading: HeadingLevel.HEADING_2,
                    }),
                    ...data.decisions.map(d => new Paragraph({ text: `• ${d}`, bullet: { level: 0 } })),
                    new Paragraph({ text: "" }),
                    new Paragraph({
                        text: "Action Items",
                        heading: HeadingLevel.HEADING_2,
                    }),
                    ...data.actionItems.map(item => new Paragraph({
                        text: `[${item.assignee}] ${item.task} (Due: ${item.due})`,
                        bullet: { level: 0 },
                    })),
                ],
            }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `STEK_Minutes_${data.title.replace(/\s+/g, "_")}.docx`);
        setIsExporting(null);
    };

    const exportToPdf = async () => {
        if (!reportRef.current || !reports) return;
        setIsExporting("pdf");

        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#050505"
            });

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
            pdf.save(`STEK_Minutes_${reports[viewLang].title.replace(/\s+/g, "_")}.pdf`);
        } catch (err) {
            console.error("PDF Export failed", err);
        } finally {
            setIsExporting(null);
        }
    };

    const currentReport = reports ? reports[viewLang] : null;

    return (
        <main className="min-h-screen relative overflow-hidden flex flex-col items-center p-6 md:p-12 lg:p-20">
            <div className="glow-mesh" />

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-20 relative"
            >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-md">
                    <Sparkles className="w-4 h-4 text-stek-primary animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Next-Gen AI Analysis</span>
                </div>
                <h1 className="text-5xl md:text-8xl font-black mb-6 tracking-tighter text-white">
                    STEK <span className="stek-gradient-text">MINUTES</span>
                </h1>
                <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-light">
                    {viewLang === 'ko'
                        ? '복잡한 회의를 단 몇 초 만에 완벽한 비즈니스 문서로 전환합니다.'
                        : 'Transform complex meetings into perfect business documents in seconds.'}
                </p>
            </motion.div>

            {/* Main Interface */}
            <div className="w-full max-w-6xl space-y-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="stek-card relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-96 h-96 bg-stek-primary/5 blur-[120px] -z-1 opacity-50 group-hover:opacity-100 transition-opacity" />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        {/* Upload Zone */}
                        <div className="space-y-6">
                            <label className="block group/upload">
                                <input
                                    type="file"
                                    accept="audio/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <div className={`cursor-pointer min-h-[300px] rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-6 ${file ? 'border-stek-primary bg-stek-primary/5' : 'border-white/10 hover:border-white/20 hover:bg-white/2'}`}>
                                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-transform group-hover/upload:scale-110 ${file ? 'bg-stek-primary text-stek-dark' : 'bg-white/5 text-gray-500'}`}>
                                        <Upload className="w-10 h-10" />
                                    </div>
                                    <div className="text-center px-6">
                                        {file ? (
                                            <>
                                                <p className="text-white font-bold text-xl mb-2 line-clamp-1">{file.name}</p>
                                                <div className="flex items-center justify-center gap-2 text-stek-primary text-xs font-black uppercase tracking-widest">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    Ready to Analyze
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-gray-300 font-bold text-xl mb-2">Drop your audio here</p>
                                                <p className="text-gray-500 text-sm max-w-[200px] mx-auto">Supports MP3, WAV, M4A up to 4.5MB (with auto-compression)</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </label>
                        </div>

                        {/* Controls Zone */}
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 flex items-center gap-2">
                                    <Zap className="w-3 h-3 text-stek-secondary" />
                                    Analysis Language
                                </label>
                                <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                                    <button
                                        onClick={() => setViewLang("ko")}
                                        className={`flex-1 py-4 rounded-xl text-xs font-black transition-all ${viewLang === 'ko' ? 'bg-stek-primary text-stek-dark shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        KOREAN
                                    </button>
                                    <button
                                        onClick={() => setViewLang("en")}
                                        className={`flex-1 py-4 rounded-xl text-xs font-black transition-all ${viewLang === 'en' ? 'bg-stek-primary text-stek-dark shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        ENGLISH
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleUpload}
                                disabled={!file || isAnalyzing}
                                className="stek-btn-primary w-full flex items-center justify-center gap-3 py-6"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 className="animate-spin w-5 h-5" />
                                        <span>{isCompressing ? 'Optimizing Audio...' : 'Analysing Engine...'}</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        <span>Generate Minutes</span>
                                    </>
                                )}
                            </button>

                            <div className="flex items-center gap-4 text-[10px] font-medium text-gray-600 border-t border-white/5 pt-6">
                                <div className="flex items-center gap-1.5">
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Vercel Optimized</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Target className="w-3 h-3" />
                                    <span>Dual-Language Output</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Error Banner */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-500 flex items-start gap-4"
                        >
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div className="text-sm font-medium leading-relaxed">{error}</div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Results Section */}
                <AnimatePresence>
                    {currentReport && (
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-12 pb-32"
                        >
                            {/* Document Viewer */}
                            <div ref={reportRef} className="stek-card bg-[#050505] border-white/10 p-12 md:p-16 relative overflow-hidden text-white shadow-2xl">
                                <div className="absolute top-0 left-0 w-2 h-full bg-stek-primary" />
                                <div className="absolute top-0 right-0 w-1/2 h-full bg-stek-primary/2 -skew-x-12 translate-x-1/2 pointer-events-none" />

                                <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20 relative z-10">
                                    <div className="space-y-4">
                                        <div className="inline-block px-3 py-1 bg-stek-primary/10 border border-stek-primary/20 rounded text-[10px] font-black text-stek-primary tracking-widest mb-2">
                                            OFFICIAL RECORD
                                        </div>
                                        <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none text-white max-w-3xl lowercase">
                                            <span className="text-stek-primary">#</span> {currentReport.title}
                                        </h2>
                                        <div className="flex items-center gap-6 text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4" />
                                                <span className="text-xs font-bold tracking-widest">{currentReport.date}</span>
                                            </div>
                                            <div className="w-1 h-1 rounded-full bg-white/20" />
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                <span className="text-xs font-bold tracking-widest uppercase">{currentReport.participants.length} Participants</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-3 no-export">
                                        {[
                                            { icon: Copy, onClick: copyToClipboard, label: 'Copy' },
                                            { icon: FileJson, onClick: exportToWord, label: 'DOCX', loading: isExporting === 'word' },
                                            { icon: Download, onClick: exportToPdf, label: 'PDF', loading: isExporting === 'pdf' }
                                        ].map((btn, i) => (
                                            <button
                                                key={i}
                                                onClick={btn.onClick}
                                                disabled={btn.loading}
                                                className="group flex items-center gap-3 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
                                            >
                                                {btn.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <btn.icon className="w-4 h-4 text-gray-400 group-hover:text-stek-primary transition-colors" />}
                                                <span className="text-[10px] font-black tracking-widest uppercase text-gray-500 group-hover:text-white transition-colors">{btn.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 relative z-10">
                                    {/* Sidebar: Participants & Decisions */}
                                    <div className="lg:col-span-4 space-y-16">
                                        <section>
                                            <h4 className="text-[10px] font-black text-stek-primary uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                                                <Users className="w-4 h-4" />
                                                Attendance
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {currentReport.participants.map((p, idx) => (
                                                    <span key={idx} className="bg-white/5 px-4 py-2 rounded-lg text-xs font-bold border border-white/5 text-gray-300">
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        </section>

                                        <section>
                                            <h4 className="text-[10px] font-black text-green-400 uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                                                <Target className="w-4 h-4" />
                                                Decisions
                                            </h4>
                                            <div className="space-y-4">
                                                {currentReport.decisions.map((d, idx) => (
                                                    <div key={idx} className="flex gap-4 group">
                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
                                                        <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-200 transition-colors">{d}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    </div>

                                    {/* Content: Summary & Discussion */}
                                    <div className="lg:col-span-8 space-y-16">
                                        <section>
                                            <h4 className="text-[10px] font-black text-stek-secondary uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                                                <FileText className="w-4 h-4" />
                                                Executive Summary
                                            </h4>
                                            <div className="relative">
                                                <p className="text-gray-300 text-xl font-light leading-relaxed italic border-l-4 border-stek-secondary/30 pl-8 py-2">
                                                    {currentReport.summary}
                                                </p>
                                            </div>
                                        </section>

                                        <section>
                                            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-10 flex items-center gap-3">
                                                <MessageSquare className="w-4 h-4" />
                                                Discussion Points
                                            </h4>
                                            <div className="space-y-12">
                                                {currentReport.discussion.map((item, idx) => (
                                                    <div key={idx} className="group relative">
                                                        <div className="absolute -left-8 top-0 bottom-0 w-[1px] bg-white/5 group-hover:bg-stek-primary/30 transition-colors" />
                                                        <h5 className="font-bold text-white text-lg mb-3 tracking-tight group-hover:text-stek-primary transition-colors">{item.topic}</h5>
                                                        <p className="text-gray-500 text-base leading-relaxed group-hover:text-gray-400 transition-colors">{item.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <section>
                                            <h4 className="text-[10px] font-black text-stek-accent uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                                                <ClipboardList className="w-4 h-4" />
                                                Action Items
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {currentReport.actionItems.map((item, idx) => (
                                                    <div key={idx} className="bg-white/[0.02] p-6 rounded-2xl border border-white/5 hover:border-stek-accent/30 transition-all hover:bg-white/[0.04]">
                                                        <p className="text-white font-bold text-sm leading-tight mb-4">{item.task}</p>
                                                        <div className="flex justify-between items-center">
                                                            <div className="px-2 py-1 rounded bg-stek-accent/10 border border-stek-accent/20 text-[9px] font-black text-stek-accent tracking-tighter uppercase italic">
                                                                {item.assignee}
                                                            </div>
                                                            <div className="text-[9px] font-medium text-gray-600 tracking-widest flex items-center gap-2">
                                                                <Calendar className="w-3 h-3" />
                                                                DUE: {item.due}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    </div>
                                </div>

                                {/* Watermark */}
                                <div className="mt-32 pt-12 border-t border-white/5 flex justify-between items-center opacity-30">
                                    <div className="text-[10px] font-black tracking-[0.8em] uppercase text-gray-500 italic">STEK INDUSTRIES</div>
                                    <div className="text-[10px] font-bold text-gray-600">STEK_MINUTES_AI_V2.8_FINAL</div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Background Branding */}
            <div className="fixed bottom-12 right-12 pointer-events-none opacity-5 select-none hidden lg:block">
                <h1 className="text-[12rem] font-black tracking-tighter leading-none -rotate-90 origin-bottom-right">STEK</h1>
            </div>
        </main>
    );
}
