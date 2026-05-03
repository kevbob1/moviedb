{{- define "moviedb.name" -}}
{{- .Chart.Name -}}
{{- end -}}

{{- define "moviedb.fullname" -}}
{{- if contains (include "moviedb.name" .) .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "moviedb.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "moviedb.labels" -}}
helm.sh/chart: "{{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}"
app.kubernetes.io/name: "{{ include "moviedb.name" . }}"
app.kubernetes.io/instance: "{{ .Release.Name }}"
app.kubernetes.io/version: "{{ .Chart.AppVersion }}"
app.kubernetes.io/managed-by: "{{ .Release.Service }}"
{{- end -}}

{{- define "moviedb.selectorLabels" -}}
app.kubernetes.io/name: "{{ include "moviedb.name" . }}"
app.kubernetes.io/instance: "{{ .Release.Name }}"
{{- end -}}

{{- define "moviedb.kafka.fullname" -}}
{{- printf "%s-kafka" (include "moviedb.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "moviedb.kafka.headless" -}}
{{- printf "%s-headless" (include "moviedb.kafka.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
