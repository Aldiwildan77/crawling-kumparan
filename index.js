const express = require('express');
const app = express();
const { request, GraphQLClient } = require('graphql-request');

const client = new GraphQLClient(
  'https://graphql-v4.kumparan.com/query',
  {
    headers: {
      'Content-Type': 'application/json'
    }
  }
);

app.use(express.json())
app.get('/crawling', async (req, res, next) => {
  const { pages, size } = req.query;
  let articles = [];
  let results = [];
  for (let page = 0; page < pages; page++) {
    let query = `{
        FindAllPublishedStories(size: ${size}, page: ${page}) {
            title,
            contentPublish {
              document
            }
            createdAt
            publisher {
                slug
            }
        }
    }`;

    await client.request(query)
      .then(result => {
        articles[page] = result;
      })
      .catch(error => {
        articles = [];
      });
  }

  let count = 0;
  articles.forEach(({ FindAllPublishedStories }) => {
    FindAllPublishedStories.map(({ contentPublish, publisher }, storyIndex) => {
      let startText = 'kumparan';
      if (contentPublish != null && publisher != null && publisher.slug.startsWith(startText)) {
        let { 'document': content } = contentPublish;
        let { document: { nodes } } = JSON.parse(content);
        let paragraphs = [];
        nodes.forEach(nodeContents => {
          if (nodeContents.type === 'paragraph') {
            paragraph = '';
            nodeContents.nodes.forEach(innerNode => {
              paragraph += extraction(innerNode);
            });

            let isContainsAlpha = false;
            let iterate = paragraph.length;
            let pattern = /^[a-zA-Z()]+$/;
            while (iterate--) {
              if (pattern.test(paragraph.charAt(iterate))) {
                isContainsAlpha = !isContainsAlpha;
                break;
              }
            }

            if (isContainsAlpha) {
              paragraphs.push(paragraph);
            }
          }
        });

        let isValid = true;
        let pattern = /^[\x00-\x7F]*$/;
        paragraphs.forEach(paragraph => {
          if (!pattern.test(paragraph)) {
            isValid = !isValid;
            return;
          }
        });

        if (isValid) {
          results.push({
            publisher: publisher.slug,
            createdAt: FindAllPublishedStories[storyIndex].createdAt,
            title: FindAllPublishedStories[storyIndex].title,
            paragraphs,
          });
          count++;
        }
      }
    });
    if (count == 10) return;
  });

  return res.status(200).json({
    message: 'fetched',
    results,
  });
});

const extraction = ({ object, type, data, 'nodes': nodesInside, leaves }) => {
  result = '';
  switch (object) {
    case 'text':
      leaves.forEach(leaf => {
        result += leaf.text;
      });
      break;
    case 'inline':
      if (type == 'link') {
        nodesInside.forEach(link => {
          result += extraction(link);
        });
      } else if (type == 'typo') {
        result += data.typo.token;
      }
      break;
    default:
      break;
  }
  return result;
}

app.listen(8881, () => console.log('Server is running, port 8881'));
