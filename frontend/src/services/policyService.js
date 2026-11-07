import api from "./api";

// Get all policies
export const getPolicies = async () => {
    const response = await api.get("/policies");
    return response.data;
};

// Upload a policy PDF
export const uploadPolicy = async (formData) => {
    const response = await api.post("/policies", formData, {
        headers: {
            "Content-Type": undefined,
        },
    });

    return response.data;
};

// Activate a policy
export const activatePolicy = async (policyId) => {
    const response = await api.patch(
        `/policies/${policyId}/activate`
    );
    return response.data;
};

// Delete one policy
export const deletePolicy = async (policyId) => {
    const response = await api.delete(`/policies/${policyId}`);
    return response.data;
};

// Delete all policies
export const deleteAllPolicies = async () => {
    const response = await api.delete("/policies");
    return response.data;
};