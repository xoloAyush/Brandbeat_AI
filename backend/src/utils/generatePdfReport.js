
/**
 * Pure JavaScript PDF Generator for Compliance Review Reports
 * Generates valid standard PDF-1.4 documents without any external dependencies.
 */

function escapePdfText(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/\r/g, "");
}

function wrapText(text, maxChars = 85) {
    if (!text) return [""];
    const words = String(text).replace(/\s+/g, " ").trim().split(" ");
    const lines = [];
    let currentLine = "";

    for (const word of words) {
        if (!currentLine) {
            currentLine = word;
        } else if (currentLine.length + 1 + word.length <= maxChars) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.length ? lines : [""];
}

export function generatePdfReport(review) {
    const pages = [];
    let currentOps = [];
    let y = 730;
    const left = 50;
    const right = 562;
    const bottom = 55;

    const startNewPage = () => {
        if (currentOps.length > 0) {
            pages.push(currentOps.join("\n"));
        }
        currentOps = [];
        y = 730;
    };

    const checkPageBreak = (neededHeight = 20) => {
        if (y - neededHeight < bottom) {
            startNewPage();
        }
    };

    const addText = (text, size = 10, isBold = false, color = [0.15, 0.15, 0.15], x = left) => {
        checkPageBreak(size + 4);
        const fontName = isBold ? "/F2" : "/F1";
        const [r, g, b] = color;
        currentOps.push(
            `q ${r} ${g} ${b} rg BT ${fontName} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET Q`
        );
        y -= (size + 4);
    };

    const addLine = (yPos = y) => {
        currentOps.push(`q 0.8 0.8 0.8 RG 1 w ${left} ${yPos} m ${right} ${yPos} l S Q`);
        y -= 10;
    };

    const addRect = (x, yPos, w, h, fill = [0.95, 0.95, 0.95], stroke = null) => {
        const [r, g, b] = fill;
        let op = `q ${r} ${g} ${b} rg `;
        if (stroke) {
            const [sr, sg, sb] = stroke;
            op += `${sr} ${sg} ${sb} RG 1 w `;
            op += `${x} ${yPos} ${w} ${h} re B Q`;
        } else {
            op += `${x} ${yPos} ${w} ${h} re f Q`;
        }
        currentOps.push(op);
    };

    // --- Page 1: Header ---
    // Title Banner
    addRect(left, y - 5, right - left, 35, [0.08, 0.15, 0.28]);
    y += 18;
    addText("BRANDBEAT COMPLIANCE REVIEW REPORT", 14, true, [1, 1, 1], left + 14);
    y -= 18;

    // Document & Review Meta
    y -= 10;
    const originalName = review.originalName || "Document";
    const dateStr = review.createdAt ? new Date(review.createdAt).toLocaleString() : new Date().toLocaleString();
    const policyName = review.policyName || "Brand Policy";
    const policyVersion = review.policyVersion || "Latest";
    const overallStatus = (review.summary?.overall_status || review.status || "COMPLETED").toUpperCase();

    addText(`Document: ${originalName}`, 11, true, [0.1, 0.1, 0.1]);
    addText(`Policy: ${policyName} (Version: ${policyVersion})`, 10, false, [0.35, 0.35, 0.35]);
    addText(`Reviewed At: ${dateStr}`, 10, false, [0.35, 0.35, 0.35]);

    // Status Badge
    let badgeBg = [0.9, 0.95, 0.9];
    let badgeText = [0.1, 0.5, 0.2];
    if (overallStatus.includes("NON") || overallStatus.includes("VIOLATION")) {
        badgeBg = [0.98, 0.9, 0.9];
        badgeText = [0.75, 0.1, 0.1];
    } else if (overallStatus.includes("REVIEW") || overallStatus.includes("CHANGES")) {
        badgeBg = [1.0, 0.96, 0.88];
        badgeText = [0.8, 0.45, 0.05];
    }

    y -= 5;
    addRect(left, y - 8, right - left, 26, badgeBg, badgeText);
    y += 10;
    addText(`COMPLIANCE VERDICT: ${overallStatus}`, 11, true, badgeText, left + 12);
    y -= 16;

    // Summary Box
    addLine();
    addText("EXECUTIVE SUMMARY", 11, true, [0.1, 0.15, 0.25]);
    y -= 4;

    const summary = review.summary || {};
    const totalStatements = summary.total_statements || review.pages * 10 || 0;
    const totalFindings = summary.total_findings ?? (review.findings?.length || 0);
    const violations = summary.violations || 0;
    const unverified = summary.unverified || 0;
    const needsReview = summary.needs_human_review || 0;

    addText(`- Total Statements Scanned: ${totalStatements}`, 10);
    addText(`- Total Findings Flagged: ${totalFindings}`, 10, true);
    addText(`- Violations: ${violations}`, 10, violations > 0, violations > 0 ? [0.75, 0.1, 0.1] : [0.2, 0.2, 0.2]);
    addText(`- Unverified Claims: ${unverified}`, 10);
    addText(`- Items Requiring Review: ${needsReview}`, 10);

    // Final Document Decision (if present)
    if (review.finalReviewStatus && review.finalReviewStatus !== "pending") {
        y -= 8;
        addLine();
        addText("ADMINISTRATIVE DECISION", 11, true, [0.1, 0.15, 0.25]);
        y -= 2;
        addText(`Final Decision: ${review.finalReviewStatus.toUpperCase()}`, 10, true);
        if (review.finalReviewComment) {
            const commentLines = wrapText(review.finalReviewComment, 80);
            for (const cl of commentLines) {
                addText(`Note: ${cl}`, 9, false, [0.3, 0.3, 0.3]);
            }
        }
    }

    // Findings List
    y -= 10;
    addLine();
    addText(`DETAILED FINDINGS (${(review.findings || []).length})`, 12, true, [0.1, 0.15, 0.25]);
    y -= 4;

    if (!review.findings || review.findings.length === 0) {
        addText("No compliance violations or issues were found in this document.", 10, false, [0.2, 0.6, 0.2]);
    } else {
        review.findings.forEach((f, idx) => {
            checkPageBreak(90);

            const pageStr = f.page !== null && f.page !== undefined ? `Page ${f.page + 1}` : "Document-wide";
            const sev = (f.severity || "medium").toUpperCase();
            const status = f.status || "FLAGGED";
            const cat = f.category || "General";

            let sevColor = [0.8, 0.45, 0.05];
            if (sev === "HIGH" || sev === "CRITICAL") sevColor = [0.75, 0.1, 0.1];
            if (sev === "LOW") sevColor = [0.2, 0.5, 0.8];

            // Finding title bar
            addRect(left, y - 4, right - left, 18, [0.96, 0.96, 0.98]);
            addText(`${idx + 1}. [${sev}] ${status} - ${cat} (${pageStr})`, 10, true, sevColor, left + 6);
            y -= 2;

            if (f.text) {
                const textLines = wrapText(`Flagged: "${f.text}"`, 80);
                for (const tl of textLines) {
                    addText(tl, 9, false, [0.15, 0.15, 0.15], left + 10);
                }
            }

            if (f.reference) {
                addText(`Policy Rule: ${f.reference}`, 9, false, [0.35, 0.35, 0.35], left + 10);
            }

            if (f.why) {
                const whyLines = wrapText(`Why: ${f.why}`, 80);
                for (const wl of whyLines) {
                    addText(wl, 9, false, [0.35, 0.35, 0.35], left + 10);
                }
            }

            if (f.suggestedFix) {
                const fixLines = wrapText(`Suggested Fix: ${f.suggestedFix}`, 80);
                for (const fl of fixLines) {
                    addText(fl, 9, false, [0.1, 0.4, 0.2], left + 10);
                }
            }

            if (f.reviewDecision && f.reviewDecision !== "pending") {
                addText(
                    `Reviewer Decision: ${f.reviewDecision.toUpperCase()}${f.reviewerComment ? ` - "${f.reviewerComment}"` : ""}`,
                    9,
                    true,
                    [0.2, 0.3, 0.6],
                    left + 10
                );
            }

            y -= 6;
        });
    }

    // Finish last page
    if (currentOps.length > 0) {
        pages.push(currentOps.join("\n"));
    }

    const totalPageCount = pages.length;

    // Add footers with page numbers
    const finalPageContents = pages.map((content, pageIndex) => {
        const pageNum = pageIndex + 1;
        const footerY = 35;
        const footerOps = [
            `q 0.8 0.8 0.8 RG 1 w ${left} ${footerY + 10} m ${right} ${footerY + 10} l S Q`,
            `q 0.5 0.5 0.5 rg BT /F1 8 Tf ${left} ${footerY} Td (Brandbeat AI Compliance Review) Tj ET Q`,
            `q 0.5 0.5 0.5 rg BT /F1 8 Tf ${right - 60} ${footerY} Td (Page ${pageNum} of ${totalPageCount}) Tj ET Q`,
        ].join("\n");

        return content + "\n" + footerOps;
    });

    // Assemble PDF Document
    const objects = [];
    const font1Obj = `${objects.length + 1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`;
    objects.push(font1Obj);

    const font2Obj = `${objects.length + 1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`;
    objects.push(font2Obj);

    const font1Id = 1;
    const font2Id = 2;

    const pageObjIds = [];
    const contentObjIds = [];

    // Reserve IDs
    for (let i = 0; i < totalPageCount; i++) {
        pageObjIds.push(objects.length + 1 + i * 2);
        contentObjIds.push(objects.length + 2 + i * 2);
    }

    const pagesParentId = objects.length + totalPageCount * 2 + 1;
    const catalogId = pagesParentId + 1;

    for (let i = 0; i < totalPageCount; i++) {
        const pageContent = finalPageContents[i];
        const contentLen = Buffer.byteLength(pageContent, "utf8");

        const pageObj = `${pageObjIds[i]} 0 obj\n<< /Type /Page /Parent ${pagesParentId} 0 R /MediaBox [0 0 612 792] /Contents ${contentObjIds[i]} 0 R /Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R >> >> >>\nendobj`;
        objects.push(pageObj);

        const contentObj = `${contentObjIds[i]} 0 obj\n<< /Length ${contentLen} >>\nstream\n${pageContent}\nendstream\nendobj`;
        objects.push(contentObj);
    }

    const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(" ");
    const pagesObj = `${pagesParentId} 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPageCount} >>\nendobj`;
    objects.push(pagesObj);

    const catalogObj = `${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesParentId} 0 R >>\nendobj`;
    objects.push(catalogObj);

    // Build byte buffer
    const header = "%PDF-1.4\n";
    let curOffset = Buffer.byteLength(header, "utf8");
    const offsets = [0];

    const bodyParts = [header];
    for (const obj of objects) {
        offsets.push(curOffset);
        const objBytes = Buffer.byteLength(obj, "utf8") + 1; // including \n
        curOffset += objBytes;
        bodyParts.push(obj + "\n");
    }

    const startXref = curOffset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
        xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    }

    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${startXref}\n%%EOF`;

    return Buffer.concat([
        Buffer.from(bodyParts.join(""), "utf8"),
        Buffer.from(xref, "utf8"),
        Buffer.from(trailer, "utf8"),
    ]);
}

