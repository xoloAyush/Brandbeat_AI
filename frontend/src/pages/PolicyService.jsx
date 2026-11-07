
import api from "../services/api";

export const getPolicies = async () => {
    const response = await api.get("/policies");
    return response.data;
};

export const uploadPolicy = async (formData) => {
    const response = await api.post("/policies", formData);
    return response.data;
};

export const activatePolicy = async (policyId) => {
    const response = await api.patch(`/policies/${policyId}/activate`);
    return response.data;
};

export const deletePolicy = async (policyId) => {
    const response = await api.delete(`/policies/${policyId}`);
    return response.data;
};

export const deleteAllPolicies = async () => {
    const response = await api.delete("/policies");
    return response.data;
};
