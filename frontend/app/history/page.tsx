import Image from "next/image";
import { Container, Typography, Box, List, ListItem, ListItemText, Divider } from "@mui/material";

export default function About() {
  return (
    <Container maxWidth="md" className="py-12">
      <Box className="flex flex-col gap-8">
        <Image
          src="/images/sarahscott1 (1).jpg"
          alt="Sarah Scott"
          width={600}
          height={400}
          className="rounded shadow-md self-center"
        />

        <Typography variant="h4" gutterBottom className="text-center font-bold">
          Our Legacy: Sarah Scott & Descendants
        </Typography>

        <Typography>
          Sarah Scott was born into slavery in the United States and showed immense courage by resisting her master's demands. She endured beatings but eventually bore five children—Victoria, Hannah, Mamie, Marcus, and Jim—named by the master after his relatives.
        </Typography>

        <Typography>
          Marcus Scott, one of Sarah's sons, married Caroline Wright of Tarboro, South Carolina. They had nine children and later moved to Burke County, Georgia, and then to Liberty County where Marcus owned a Turpentine and Timber Farm.
        </Typography>

        <Typography>
          The Scott children grew up and married as follows:
        </Typography>

        <List dense className="bg-gray-50 p-4 rounded shadow-sm">
          <ListItem><ListItemText primary="Mamie Scott married Willie Flynn of Reidsville, Georgia." /></ListItem>
          <ListItem><ListItemText primary="Ellen Scott united with John Henry Phillips of Raleigh, NC. They had 10 children and raised four others." /></ListItem>
          <ListItem><ListItemText primary="Marcus Scott Jr. (Big Bubba) married Maggie Williams, and after her death, Lena Roundtree." /></ListItem>
          <ListItem><ListItemText primary="Sandy Betrol married Janie Parker of Ludowici, Georgia." /></ListItem>
          <ListItem><ListItemText primary="Eugene Scott married Anna Harris of Ludowici." /></ListItem>
          <ListItem><ListItemText primary="Jeff married Mary Mitchell of Savannah." /></ListItem>
          <ListItem><ListItemText primary="Joe Scott married Francis Slater from Ludowici." /></ListItem>
          <ListItem><ListItemText primary="Willie Scott married Mae Hill, and after her passing, married Hattie of Savannah." /></ListItem>
          <ListItem><ListItemText primary="Jim ?" /></ListItem>
        </List>

        <Divider className="my-6" />

        <Typography>
          The family, though dispersed, began an annual feast tradition. One of the early feasts was hosted by Willie and Mamie Flynn in 1926, with a large family photo taken to mark the event.
        </Typography>

        <Typography>
          These gatherings inspired a formal family reunion, organized first at Marcus and Lena Scott's home. Since then, the Scott-Phillips family has held annual reunions every third Sunday in July.
        </Typography>

        <Image
          src="/images/sarahscott1 (1).jpg"
          alt="Scott Family Gathering"
          width={600}
          height={400}
          className="rounded shadow-md self-center"
        />

        <Typography>
          The first organized reunion saw Marcus Scott elected as president. Over the years, the reunion grew in size and sentiment, giving glory to God for continued strength and togetherness.
        </Typography>

        <Typography>
          Eugene Scott, the last living child of Marcus and Caroline, passed at 91. His wife, Anna, lived to 95. We recognize Eugene and Anna Scott, Eva Poole, and contributors Jacquelyn Maxwell and Gwendolyn Walker for preserving this history.
        </Typography>
      </Box>
    </Container>
  );
}
