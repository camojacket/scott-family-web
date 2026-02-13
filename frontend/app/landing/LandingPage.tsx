import React, { useState } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  TextField,
  Paper,
  Stack,
  Link,
  InputLabel,
} from "@mui/material";

type FormMode = "login" | "signup";

const LandingPage: React.FC = () => {
  const [mode, setMode] = useState<FormMode | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    displayName: "",
    bio: "",
    profilePicture: undefined as File | undefined,
    bannerImage: undefined as File | undefined,
  });

  const [errors, setErrors] = useState({
    username: "",
    password: "",
    email: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "profilePicture" | "bannerImage"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm({ ...form, [field]: file });
    }
  };

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validateUsername = async (username: string) => {
    const regex = /^[a-zA-Z0-9_]{3,}$/;
    if (!regex.test(username))
      return "Must be at least 3 characters and contain only letters, numbers, or underscores.";
    // TODO: async check with backend for uniqueness
    return "";
  };

  const validatePassword = (password: string) => {
    if (password.length < 8) return "Minimum 8 characters.";
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return "Must include at least one letter and one number.";
    }
    return "";
  };

  const handleLogin = () => {
    // TODO: submit login
  };

  const handleSignup = async () => {
    const usernameError = await validateUsername(form.username);
    const passwordError = validatePassword(form.password);
    const emailError = validateEmail(form.email) ? "" : "Invalid email format.";

    setErrors({ username: usernameError, password: passwordError, email: emailError });

    if (!usernameError && !passwordError && !emailError) {
      // TODO: submit signup with form data
    }
  };

  const renderInitialButtons = () => (
    <Stack spacing={2} alignItems="center">
      <Button variant="contained" size="large" onClick={() => setMode("signup")}>Signup</Button>
      <Button variant="outlined" size="large" onClick={() => setMode("login")}>Login</Button>
    </Stack>
  );

  const renderLoginForm = () => (
    <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
      <Stack spacing={2}>
        <TextField name="username" label="Username" fullWidth required onChange={handleInputChange} />
        <TextField name="password" label="Password" type="password" fullWidth required onChange={handleInputChange} />
        <Link href="#" underline="hover" align="right">Forgot password?</Link>
        <Button type="submit" variant="contained">Login</Button>
      </Stack>
    </Box>
  );

  const renderSignupForm = () => (
    <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); handleSignup(); }}>
      <Stack spacing={2}>
        <TextField
          name="username"
          label="Username"
          fullWidth
          required
          error={!!errors.username}
          helperText={errors.username}
          onBlur={async () => {
            const msg = await validateUsername(form.username);
            setErrors((e) => ({ ...e, username: msg }));
          }}
          onChange={handleInputChange}
        />

        <TextField
          name="password"
          label="Password"
          type="password"
          fullWidth
          required
          error={!!errors.password}
          helperText={errors.password}
          onChange={(e) => {
            handleInputChange(e);
            const msg = validatePassword(e.target.value);
            setErrors((prev) => ({ ...prev, password: msg }));
          }}
        />

        <TextField
          name="email"
          label="Email"
          type="email"
          fullWidth
          required
          error={!!errors.email}
          helperText={errors.email}
          onBlur={() => {
            const msg = validateEmail(form.email) ? "" : "Invalid email format.";
            setErrors((e) => ({ ...e, email: msg }));
          }}
          onChange={handleInputChange}
        />

        <TextField name="displayName" label="Display Name" fullWidth required onChange={handleInputChange} />
        <TextField name="bio" label="Bio" multiline rows={3} fullWidth onChange={handleInputChange} />

        <Box>
          <InputLabel>Profile Picture</InputLabel>
          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, "profilePicture")} />
        </Box>

        <Box>
          <InputLabel>Banner Image</InputLabel>
          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, "bannerImage")} />
        </Box>

        <Typography variant="body2" color="text.secondary">
          Note: Your signup is subject to admin approval. You will receive an email upon review.
        </Typography>

        <Button type="submit" variant="contained">Submit Signup</Button>
      </Stack>
    </Box>
  );

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper elevation={4} sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
        <Typography variant="h3" gutterBottom fontWeight="bold">
          SCOTT'S FAMILY
        </Typography>

        {mode === null && renderInitialButtons()}
        {mode === "login" && renderLoginForm()}
        {mode === "signup" && renderSignupForm()}

        {mode !== null && (
          <Box mt={3}>
            <Button variant="text" onClick={() => setMode(null)}>← Back</Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default LandingPage;
