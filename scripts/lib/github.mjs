const token = process.env.GH_ACTIVITY_TOKEN || process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;

if (!token || !repository) {
  throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
}

const [owner, repo] = repository.split("/");
if (!owner || !repo) throw new Error(`Invalid repository: ${repository}`);

export async function api(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub API ${response.status} ${path}: ${detail}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function getFile(path) {
  try {
    const data = await api(`/repos/${owner}/${repo}/contents/${encodePath(path)}`);
    return {
      content: Buffer.from(data.content, data.encoding).toString("utf8"),
      sha: data.sha,
    };
  } catch (error) {
    if (String(error.message).includes("GitHub API 404")) return null;
    throw error;
  }
}

export async function putFile(path, content, message, sha) {
  const body = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
  };
  if (sha) body.sha = sha;
  return api(`/repos/${owner}/${repo}/contents/${encodePath(path)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteFile(path, sha, message) {
  return api(`/repos/${owner}/${repo}/contents/${encodePath(path)}`, {
    method: "DELETE",
    body: JSON.stringify({ message, sha }),
  });
}

export async function getTree() {
  const repositoryData = await api(`/repos/${owner}/${repo}`);
  return api(`/repos/${owner}/${repo}/git/trees/${repositoryData.default_branch}?recursive=1`);
}

export async function getIssue(number) {
  return api(`/repos/${owner}/${repo}/issues/${number}`);
}

export const repoOwner = owner;
export const repoName = repo;

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}
