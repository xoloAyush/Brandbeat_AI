import api from "./api";

// Create a new compliance review
export const createReview = async (formData) => {
    const response = await api.post("/reviews", formData);
    return response.data;
};

// Get all reviews
export const getReviews = async () => {
    const response = await api.get("/reviews");
    return response.data;
};

// Get one review
export const getReviewById = async (reviewId) => {
    const response = await api.get(`/reviews/${reviewId}`);
    return response.data;
};

// Download a review artifact (PDF, JSON, or Markdown)
export const downloadReviewArtifact = async (reviewId, artifact) => {
    const response = await api.get(
        `/reviews/${reviewId}/download/${artifact}`,
        {
            responseType: "blob",
        }
    );

    return response.data;
};

// Update human decision for an AI finding
export const updateFindingDecision = async (
    reviewId,
    findingKey,
    decision,
    comment = ""
) => {
    const response = await api.patch(
        `/reviews/${reviewId}/findings/${encodeURIComponent(findingKey)}/decision`,
        {
            decision,
            comment,
        }
    );

    return response.data;
};

export const updateFinalReviewDecision = async (
    id,
    decision,
    comment = ""
) => {
    const response = await api.patch(
        `/reviews/${id}/final-decision`,
        {
            decision,
            comment,
        }
    );

    return response;
};