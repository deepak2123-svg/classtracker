package com.classtracker.feature.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import com.classtracker.core.designsystem.LedgrBlue
import com.classtracker.core.designsystem.LedgrTheme

@Composable
fun AuthScreen(
    loading: Boolean,
    errorMessage: String?,
    googleSignInConfigured: Boolean,
    onGoogleSignIn: () -> Unit,
    onEmailSignIn: (email: String, password: String) -> Unit,
    onCreateAccount: (name: String, email: String, password: String) -> Unit,
    onClearError: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var createMode by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    fun submit() {
        if (email.isBlank() || password.isBlank() || loading) return
        if (createMode) {
            if (name.isNotBlank() && password.length >= 6) {
                onCreateAccount(name.trim(), email.trim(), password)
            }
        } else {
            onEmailSignIn(email.trim(), password)
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 30.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Surface(
                modifier = Modifier.size(64.dp),
                color = LedgrBlue,
                contentColor = androidx.compose.ui.graphics.Color.White,
                shape = MaterialTheme.shapes.large,
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = "L",
                        style = MaterialTheme.typography.displaySmall,
                    )
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Ledgr",
                style = MaterialTheme.typography.headlineMedium,
            )
            Text(
                text = "Teacher",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(28.dp))

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        listOf(false to "Sign in", true to "Create account").forEach { (mode, label) ->
                            if (createMode == mode) {
                                Button(
                                    onClick = {
                                        createMode = mode
                                        onClearError()
                                    },
                                    modifier = Modifier.weight(1f),
                                ) {
                                    Text(label)
                                }
                            } else {
                                OutlinedButton(
                                    onClick = {
                                        createMode = mode
                                        onClearError()
                                    },
                                    modifier = Modifier.weight(1f),
                                ) {
                                    Text(label)
                                }
                            }
                        }
                    }

                    OutlinedButton(
                        onClick = onGoogleSignIn,
                        enabled = googleSignInConfigured && !loading,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.onSurface,
                        ),
                    ) {
                        Text("Continue with Google")
                    }

                    if (!googleSignInConfigured) {
                        Text(
                            text = "Google sign-in is pending for the beta app.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        HorizontalDivider(modifier = Modifier.weight(1f))
                        Text(
                            text = "OR",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        HorizontalDivider(modifier = Modifier.weight(1f))
                    }

                    if (createMode) {
                        OutlinedTextField(
                            value = name,
                            onValueChange = {
                                name = it
                                onClearError()
                            },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Your name") },
                            singleLine = true,
                            enabled = !loading,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                            colors = TextFieldDefaults.colors(
                                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                                focusedContainerColor = MaterialTheme.colorScheme.surface,
                            ),
                        )
                    }

                    OutlinedTextField(
                        value = email,
                        onValueChange = {
                            email = it
                            onClearError()
                        },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Email") },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Outlined.Mail,
                                contentDescription = null,
                            )
                        },
                        singleLine = true,
                        enabled = !loading,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next,
                        ),
                        colors = TextFieldDefaults.colors(
                            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                            focusedContainerColor = MaterialTheme.colorScheme.surface,
                        ),
                    )

                    OutlinedTextField(
                        value = password,
                        onValueChange = {
                            password = it
                            onClearError()
                        },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Password") },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Outlined.Lock,
                                contentDescription = null,
                            )
                        },
                        singleLine = true,
                        enabled = !loading,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done,
                        ),
                        keyboardActions = KeyboardActions(onDone = { submit() }),
                        colors = TextFieldDefaults.colors(
                            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                            focusedContainerColor = MaterialTheme.colorScheme.surface,
                        ),
                    )

                    errorMessage?.let { message ->
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = MaterialTheme.colorScheme.errorContainer,
                            contentColor = MaterialTheme.colorScheme.onErrorContainer,
                            shape = MaterialTheme.shapes.medium,
                        ) {
                            Text(
                                text = message,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(12.dp),
                            )
                        }
                    }

                    if (createMode && password.isNotEmpty() && password.length < 6) {
                        Text(
                            text = "Use at least 6 characters for the password.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }

                    Button(
                        onClick = ::submit,
                        enabled = email.isNotBlank() &&
                            password.isNotBlank() &&
                            (!createMode || (name.isNotBlank() && password.length >= 6)) &&
                            !loading,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (loading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary,
                            )
                        } else {
                            Text(if (createMode) "Create account" else "Sign in")
                        }
                    }

                }
            }
        }
    }
}

@Preview(showBackground = true, widthDp = 390, heightDp = 800)
@Composable
private fun AuthScreenPreview() {
    LedgrTheme(darkTheme = false) {
        AuthScreen(
            loading = false,
            errorMessage = null,
            googleSignInConfigured = false,
            onGoogleSignIn = {},
            onEmailSignIn = { _, _ -> },
            onCreateAccount = { _, _, _ -> },
            onClearError = {},
        )
    }
}
