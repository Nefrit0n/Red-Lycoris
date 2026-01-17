import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AnalysisJob,
  downloadAnalysisArtifact,
  fetchAnalysisJob,
} from "../api/analysisJobs";

const AnalysisJobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const loadJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAnalysisJob(id);
      setJob(response);
    } catch (err) {
      setError("Не удалось загрузить анализ.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const handleDownload = async (artifact: "semgrep" | "trivy") => {
    if (!id) return;
    setDownloadError(null);
    try {
      const blob = await downloadAnalysisArtifact(id, artifact);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = artifact === "semgrep" ? "result_semgrep.json" : "trivy_result.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Не удалось скачать артефакт");
    }
  };

  if (!id) {
    return (
      <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }}>
        <Alert severity="error">ID анализа не задан.</Alert>
      </Box>
    );
  }

  return (
    <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Analysis Job
          </Typography>
          <Button variant="text" onClick={() => navigate("/analyze")}>Назад к списку</Button>
        </Box>

        {loading && (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {job && (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Job ID: {job.id}</Typography>
                <Typography color="text.secondary">Статус: {job.status}</Typography>
                <Typography color="text.secondary">
                  Продукт: {job.productName || job.productId || "—"}
                </Typography>
                {job.engagementId && (
                  <Typography color="text.secondary">Engagement: {job.engagementId}</Typography>
                )}
                <Typography color="text.secondary">
                  Сканеры: {job.scanners.join(", ")}
                </Typography>
                <Typography color="text.secondary">
                  Семантика: Semgrep {job.semgrepStatus} · Trivy {job.trivyStatus}
                </Typography>
                <Typography color="text.secondary">
                  Created: {new Date(job.createdAt).toLocaleString("ru-RU")}
                </Typography>
                {job.finishedAt && (
                  <Typography color="text.secondary">
                    Finished: {new Date(job.finishedAt).toLocaleString("ru-RU")}
                  </Typography>
                )}
                <Divider />
                <Typography variant="subtitle2">Findings</Typography>
                <Typography color="text.secondary">
                  Total: {job.findingsTotal} · New: {job.findingsNew} · Duplicates: {job.duplicatesTotal}
                </Typography>
                {job.errorMessage && <Alert severity="error">{job.errorMessage}</Alert>}
                <Divider />
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <Button
                    variant="contained"
                    onClick={() => handleDownload("semgrep")}
                    disabled={!job.artifactSemgrep}
                  >
                    Скачать result_semgrep.json
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => handleDownload("trivy")}
                    disabled={!job.artifactTrivy}
                  >
                    Скачать trivy_result.json
                  </Button>
                </Stack>
                {downloadError && <Alert severity="error">{downloadError}</Alert>}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
};

export default AnalysisJobDetail;
