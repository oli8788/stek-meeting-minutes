import "@/styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "STEK AI Meeting Minutes",
    description: "STEK 전용 AI 회의록 분석 및 정리 솔루션",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    );
}
