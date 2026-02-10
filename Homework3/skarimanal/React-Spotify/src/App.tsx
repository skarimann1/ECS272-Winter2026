import { useState } from 'react';
import Example from './components/Example'
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { grey } from '@mui/material/colors';
import TopArtistsBarChart from './components/TopArtistsBarChart';
import GenreYearHeatmap from './components/GenreYearHeatmap';
import LengthPopularityStream from './components/LengthPopularityStream';



// Adjust the color theme for material ui
const theme = createTheme({
  palette: {
    primary:{
      main: grey[700],
    },
    secondary:{
      main: grey[700],
    }
  },
})

// For how Grid works, refer to https://mui.com/material-ui/react-grid/

function Layout() {
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);

  return (
    <Box id="main-container" sx={{ height: "100vh", p: 1, boxSizing: "border-box" }}>
      <Grid container spacing={1} sx={{ height: "100%" }}>
        {/* Top row - context view: bar chart */}
        <Grid size={6} sx={{ height: "45%" }}>
          <Box sx={{ height: "100%", bgcolor: "white", borderRadius: 1, p: 1 }}>
            <TopArtistsBarChart
              selectedArtist={selectedArtist}
              onSelectArtist={setSelectedArtist}
            />
          </Box>
        </Grid>

        <Grid size={6} sx={{ height: "45%" }}>
          <Box sx={{ height: "100%", bgcolor: "white", borderRadius: 1, p: 1 }}>
            <LengthPopularityStream selectedArtist={selectedArtist} />
          </Box>
        </Grid>

        {/* Bottom row */}
        <Grid size={12} sx={{ height: "55%" }}>
          <Box sx={{ height: "100%", bgcolor: "white", borderRadius: 1, p: 1 }}>
            <GenreYearHeatmap />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}



function App() {
  return (
    <ThemeProvider theme={theme}>
      <Layout />
    </ThemeProvider>
  )
}

export default App
