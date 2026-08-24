// Запросы к Upwork GraphQL API.
// Используем ДВЕ ветки, как выяснили в GQL Explorer:
// - publicMarketplaceJobPostingsSearch: title, description, publishedDateTime, hourlyBudgetMin/Max
// - marketplaceJobPostings: client.location.country, client.totalFeedback (рейтинг),
//   client.verificationStatus (payment verified), client.totalPostedJobs

const GRAPHQL_URL = "https://api.upwork.com/graphql";

async function graphqlRequest(accessToken, query, variables) {
  const resp = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await resp.json();

  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

// Публичная ветка: бюджет (hourly), дата публикации, текст вакансии
async function searchPublicJobs(accessToken, keyword) {
  const query = `
    query SearchPublicJobs($q: String!) {
      publicMarketplaceJobPostingsSearch(marketPlaceJobFilter: { searchExpression_eq: $q }) {
        jobs {
          id
          ciphertext
          title
          description
          publishedDateTime
          hourlyBudgetMin
          hourlyBudgetMax
        }
      }
    }
  `;
  const data = await graphqlRequest(accessToken, query, { q: keyword });
  return data.publicMarketplaceJobPostingsSearch?.jobs || [];
}

// Закрытая ветка: данные о клиенте (страна, рейтинг, verification, posted jobs)
async function searchClientInfo(accessToken, keyword) {
  const query = `
    query SearchJobsClientInfo($q: String!) {
      marketplaceJobPostings(marketPlaceJobFilter: { searchExpression_eq: $q }) {
        edges {
          node {
            id
            client {
              totalPostedJobs
              totalReviews
              totalFeedback
              verificationStatus
              location {
                country
              }
            }
          }
        }
      }
    }
  `;
  const data = await graphqlRequest(accessToken, query, { q: keyword });
  const edges = data.marketplaceJobPostings?.edges || [];
  return edges.map((e) => e.node);
}

function normalizeId(id) {
  if (!id) return "";
  return String(id).replace(/^~[0-9]+/, "").replace(/^~/, "");
}

// Объединяет данные из обеих веток по id вакансии
async function fetchJobsForKeyword(accessToken, keyword) {
  const [publicJobs, clientInfoJobs] = await Promise.all([
    searchPublicJobs(accessToken, keyword),
    searchClientInfo(accessToken, keyword),
  ]);

  const clientInfoById = new Map(
    clientInfoJobs.map((j) => [normalizeId(j.id), j.client])
  );

  return publicJobs.map((job) => ({
    ...job,
    client: clientInfoById.get(normalizeId(job.id)) || null,
    matchedKeyword: keyword,
  }));
}

module.exports = { fetchJobsForKeyword };
