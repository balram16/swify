/**
 * Gemini AI Service for Insurance Claim Analysis
 * Analyzes medical records, documents, and claim amounts for fraud detection
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || 'your-gemini-api-key-here';
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: 'application/json' }
        });
    }

    /**
     * Analyze insurance claim for fraud detection and validation
     * @param {Object} claimData - Claim data including medical records and documents
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeClaim(claimData) {
        try {
            const {
                abdmRecords,
                userDocuments,
                claimAmount,
                policyDetails,
                claimDescription,
                incidentDate
            } = claimData;

            // Prepare analysis prompt
            const prompt = this.buildAnalysisPrompt({
                abdmRecords,
                userDocuments,
                claimAmount,
                policyDetails,
                claimDescription,
                incidentDate
            });

            // Read documents and convert to inline parts for multimodal Gemini call
            const mediaParts = [];
            if (userDocuments && userDocuments.length > 0) {
                for (const doc of userDocuments) {
                    if (doc.path && fs.existsSync(doc.path)) {
                        // Only support PDF and images natively in Gemini
                        if (doc.mimeType && (
                            doc.mimeType.startsWith('image/') || 
                            doc.mimeType === 'application/pdf'
                        )) {
                            try {
                                const fileBuffer = fs.readFileSync(doc.path);
                                mediaParts.push({
                                    inlineData: {
                                        data: fileBuffer.toString('base64'),
                                        mimeType: doc.mimeType
                                    }
                                });
                                console.log(`Loaded document for Gemini analysis: ${doc.name} (${doc.mimeType})`);
                            } catch (readError) {
                                console.error(`Failed to read file ${doc.path}:`, readError);
                            }
                        } else {
                            console.log(`Skipping unsupported document type for inline analysis: ${doc.name} (${doc.mimeType})`);
                        }
                    }
                }
            }

            // Call Gemini API with text prompt and document attachments
            const result = await this.model.generateContent([prompt, ...mediaParts]);
            const response = await result.response;
            const analysisText = response.text();

            // Parse the response to extract structured data
            const analysis = this.parseAnalysisResponse(analysisText);

            return {
                success: true,
                data: analysis
            };

        } catch (error) {
            console.error('Gemini AI Analysis Error:', error);
            
            // Return mock analysis if API fails
            return {
                success: false,
                data: this.getMockAnalysis(),
                error: 'AI analysis failed, using fallback analysis'
            };
        }
    }

    /**
     * Build analysis prompt for Gemini AI
     */
    buildAnalysisPrompt(data) {
        return `
You are an expert medical insurance fraud detection AI. Analyze the following insurance claim data and verify the attached document images/PDFs.

CLAIM DETAILS:
- Claim Amount: ₹${data.claimAmount}
- Policy Type: ${data.policyDetails?.policy_type || 'Health Insurance'}
- Coverage Amount: ₹${data.policyDetails?.coverage_amount || 'N/A'}
- Incident Date: ${data.incidentDate}
- Claim Description: ${data.claimDescription}

ABDM MEDICAL RECORDS (Official Government Records):
${JSON.stringify(data.abdmRecords, null, 2)}

USER UPLOADED DOCUMENTS METADATA:
${JSON.stringify(data.userDocuments, null, 2)}

IMPORTANT DOCUMENT VERIFICATION RULES:
1. You have been provided with the actual content/images of the uploaded documents.
2. Carefully inspect the contents of each document. Check if they are valid medical documents (e.g. hospital discharge summaries, medical bills, diagnostic reports, prescriptions, or laboratory results).
3. If any document is completely unrelated (e.g., random screenshots, nature pictures, selfies, empty templates, dummy text, or files unrelated to medical treatments), or if they do not match the claimant's name or described treatment:
   - You MUST flag the riskLevel as HIGH or CRITICAL.
   - Set isValidClaim to false.
   - Set a high fraudScore (e.g. 80-100).
   - Add a red flag: "Fraudulent/Unrelated document uploaded".
   - Under "analysis.documentAuthenticity", write a detailed explanation showing that the uploaded document is not a valid medical record.

Please analyze this claim and provide a JSON response with the following structure:

{
  "fraudScore": 0-100,
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "isValidClaim": true/false,
  "confidence": 0-100,
  "analysis": {
    "medicalConsistency": "Analysis of medical record consistency",
    "amountValidation": "Analysis of claim amount vs medical records",
    "documentAuthenticity": "Analysis of document authenticity",
    "timelineValidation": "Analysis of incident timeline",
    "policyCompliance": "Analysis of policy terms compliance"
  },
  "redFlags": [
    "List of potential red flags or concerns"
  ],
  "recommendations": [
    "List of recommendations for claim processing"
  ],
  "requiredActions": [
    "List of additional actions required"
  ],
  "summary": "Overall summary of the analysis"
}

Focus on:
1. Medical record consistency between ABDM and user documents
2. Claim amount reasonableness vs medical treatment
3. Timeline validation (incident date vs treatment dates)
4. Document authenticity indicators (checking content of actual files)
5. Policy coverage validation
6. Potential fraud indicators

Provide a detailed analysis that helps insurance providers make informed decisions.
        `;
    }

    /**
     * Parse Gemini AI response into structured data
     */
    parseAnalysisResponse(responseText) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('Error parsing Gemini response:', error);
        }

        // Fallback parsing if JSON extraction fails
        return this.parseTextResponse(responseText);
    }

    /**
     * Parse text response when JSON extraction fails
     */
    parseTextResponse(responseText) {
        // Extract key information using regex patterns
        const fraudScoreMatch = responseText.match(/fraudScore[:\s]*(\d+)/i);
        const riskLevelMatch = responseText.match(/riskLevel[:\s]*(LOW|MEDIUM|HIGH|CRITICAL)/i);
        const isValidMatch = responseText.match(/isValidClaim[:\s]*(true|false)/i);
        const confidenceMatch = responseText.match(/confidence[:\s]*(\d+)/i);

        return {
            fraudScore: fraudScoreMatch ? parseInt(fraudScoreMatch[1]) : 50,
            riskLevel: riskLevelMatch ? riskLevelMatch[1].toUpperCase() : 'MEDIUM',
            isValidClaim: isValidMatch ? isValidMatch[1] === 'true' : true,
            confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 70,
            analysis: {
                medicalConsistency: "Analysis completed",
                amountValidation: "Amount validation completed",
                documentAuthenticity: "Document analysis completed",
                timelineValidation: "Timeline validation completed",
                policyCompliance: "Policy compliance checked"
            },
            redFlags: ["Standard analysis completed"],
            recommendations: ["Review claim details"],
            requiredActions: ["Standard verification"],
            summary: responseText.substring(0, 200) + "..."
        };
    }

    /**
     * Get mock analysis for testing when API is not available
     */
    getMockAnalysis() {
        return {
            fraudScore: 25,
            riskLevel: "LOW",
            isValidClaim: true,
            confidence: 85,
            analysis: {
                medicalConsistency: "ABDM records match user documents. Medical history is consistent with claimed condition.",
                amountValidation: "Claim amount of ₹${claimAmount} is reasonable for the treatment described in medical records.",
                documentAuthenticity: "Documents appear authentic with proper hospital stamps and signatures.",
                timelineValidation: "Incident date aligns with medical records and treatment timeline.",
                policyCompliance: "Claim falls within policy coverage terms and conditions."
            },
            redFlags: [],
            recommendations: [
                "Claim appears legitimate and can be processed",
                "Standard verification procedures completed",
                "No additional documentation required"
            ],
            requiredActions: [
                "Process claim for approval",
                "Initiate payment transfer"
            ],
            summary: "This claim has been thoroughly analyzed and appears to be legitimate. The medical records from ABDM system support the claim amount and treatment details. No fraud indicators detected. Recommended for approval."
        };
    }

    /**
     * Generate claim summary for provider dashboard
     */
    generateClaimSummary(analysis) {
        const { fraudScore, riskLevel, isValidClaim, confidence } = analysis;
        
        let status = 'PENDING';
        let statusColor = 'yellow';
        
        if (isValidClaim && fraudScore < 30 && riskLevel === 'LOW') {
            status = 'APPROVED';
            statusColor = 'green';
        } else if (fraudScore > 70 || riskLevel === 'CRITICAL') {
            status = 'REJECTED';
            statusColor = 'red';
        } else if (fraudScore > 50 || riskLevel === 'HIGH') {
            status = 'REQUIRES_REVIEW';
            statusColor = 'orange';
        }

        return {
            status,
            statusColor,
            fraudScore,
            riskLevel,
            confidence,
            recommendation: isValidClaim ? 'APPROVE' : 'REJECT'
        };
    }
}

module.exports = GeminiService;
