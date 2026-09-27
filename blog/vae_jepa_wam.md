---
title: Reconstruct or Predict?
subtitle: How World Action Models Choose Their World State, from VAE Latents to JEPA
date: 2026-09-24
description: Many world action models inherit a VAE latent from video generation. This post asks what a robot's world state should actually keep, and follows the shift toward JEPA representations shaped by prediction and control.
tags: [WAM]
lang: en
---

# Reconstruct or Predict?

## How World Action Models Choose Their World State, from VAE Latents to JEPA

## 1. The real question is what counts as a world state

A World Action Model needs an internal state that supports two jobs. It should summarize what matters in the current scene, and it should support prediction of how that scene changes when the robot acts. This makes representation design a central part of WAM design. A model can have a powerful action head and a large backbone, yet its control quality still depends on whether the latent state organizes geometry, motion, objects, and contact in a form that the dynamics model can use.

A useful mental model separates three components. The encoder decides how the robot represents what it sees. The world model predicts how that representation evolves. The action module maps the current representation and task context into executable control. In symbols,

\[
x_t \xrightarrow{E} z_t,
\]

\[
(z_t, a_t) \xrightarrow{F} z_{t+\Delta t},
\]

\[
(z_t, \ell, s_t) \xrightarrow{\pi} a_{t:t+H}.
\]

Here \(x_t\) is the observation, \(z_t\) is its latent state, \(a_t\) is an action, \(\ell\) is a language instruction, \(s_t\) is the robot proprioceptive state, and \(H\) is the action chunk horizon. The encoder \(E\), world model \(F\), and policy \(\pi\) solve different problems even when a single neural network shares parameters across them.

This separation also clarifies a common source of confusion. VAE is one possible way to construct \(z_t\). JEPA is another family of representation learning methods. WAM describes the larger control architecture and learning problem. OpenWAM makes this modular view explicit by treating visual representation, generative backbone, information flow, inference procedure, and training data as distinct design dimensions. [^openwam]

## 2. What a VAE actually does

A Variational Autoencoder starts from the idea that a high dimensional observation can be represented by a smaller latent variable. Given an image \(x\), the encoder produces the parameters of a latent distribution,

\[
q_\phi(z \mid x)
=
\mathcal{N}\left(\mu_\phi(x), \sigma_\phi(x)^2 I\right).
\]

A latent sample is then obtained through the reparameterization trick,

\[
z
=
\mu_\phi(x)
+
\sigma_\phi(x) \odot \epsilon,
\qquad
\epsilon \sim \mathcal{N}(0,I).
\]

A decoder maps \(z\) back into observation space. The canonical VAE objective balances data reconstruction with a regularization term that keeps the approximate posterior close to a prior distribution. [^vae]

The practical consequence is easy to understand. A VAE learns a latent that remains useful for reconstructing the observation. If a wooden table contains a fine texture, the decoder benefits when the latent preserves enough information to recover that texture. If lighting changes, the latent may also change because lighting contributes to the pixels that the decoder reconstructs.

This property is valuable for image and video generation. A generator can operate on a compressed latent tensor and later decode the result into RGB pixels. Modern latent video models often use a VAE style autoencoder or a closely related learned visual tokenizer for exactly this reason. The heavy generative model works in a smaller space while the decoder handles pixel reconstruction at the end.

## 3. Why many WAMs inherited VAE latents

A large branch of WAM research grew out of pretrained video generation models. The video model had already learned useful regularities about motion, object interaction, and temporal evolution. Researchers could add robot action prediction and embodied training while retaining much of that pretrained world knowledge.

The resulting lineage looks like this:

\[
\text{video}
\rightarrow
\text{visual autoencoder}
\rightarrow
\text{video latent}
\rightarrow
\text{video backbone}
\rightarrow
\text{future latent}.
\]

A WAM built from that model can attach an action pathway to the same backbone:

\[
z_t
\rightarrow
\text{shared world backbone}
\rightarrow
\begin{cases}
\text{future representation} \\
\text{robot action}
\end{cases}
\]

This history explains why VAE latents appear so often in WAM diagrams. The latent representation arrives together with the pretrained video model. The WAM inherits a complete package that already contains an encoder, a generative latent space, and a dynamics capable backbone.

Fast-WAM provides an important clue about which part of this package matters most. Its controlled variants retain video co training during learning while removing explicit future generation during deployment. The paper reports that removing video co training causes a much larger performance drop than removing test time future imagination, and its deployed model reaches 190 ms latency in the reported setup. The authors interpret these experiments as evidence that video modeling can contribute strongly through the representation learned during training. [^fastwam]

This result shifts attention toward the latent state itself. Once future RGB generation is no longer required at deployment, the field can ask a more direct question: what representation best captures the parts of the world that matter for control?

## 4. The strongest criticism of VAE based world states

The most useful criticism focuses on the alignment between the VAE objective and the needs of robot control. A reconstruction objective rewards preservation of visual detail. A control objective rewards preservation of state variables that determine how actions change the world. These objectives overlap, yet their priorities differ.

Consider a cup on a table. A lighting change may alter many pixels while leaving the grasp geometry unchanged. A VAE latent can encode that appearance change because it supports reconstruction. A robot policy would prefer a representation whose geometry, object pose, contact state, and motion remain easy to read even as appearance varies.

This is where claims about rotation and affine transformations need careful interpretation. Control does not generally want complete invariance to rotation. If a tool rotates by twenty degrees, that change can be crucial for the next action. The useful property is structured equivariance. If \(R\) denotes a transformation in the physical scene, an idealized encoder would satisfy a relationship such as

\[
E(Rx)
\approx
\rho(R)E(x),
\]

where \(\rho(R)\) is a predictable transformation in latent space. The representation changes because the physical state changes, and the change follows an organized rule that a dynamics model can learn.

A reconstruction trained latent has no general guarantee that the physical transformation \(R\) becomes a simple transformation \(\rho(R)\) in latent space. A small camera rotation can therefore induce a complicated change across many latent dimensions. The world model must learn both the physical dynamics and the coordinate system created by the encoder.

The same reasoning applies to time. A transition from frame \(t\) to frame \(t+1\) at 30 frames per second represents a different physical displacement from a transition that skips three frames. A clean formulation exposes the time interval directly:

\[
F(z_t, a_t, \Delta t)
\rightarrow
z_{t+\Delta t}.
\]

Training only at a fixed temporal stride can make any learned representation and dynamics model sensitive to that discretization. JEPA changes the representation objective, while temporal robustness still benefits from explicit time conditioning, varied temporal offsets, or training data that covers multiple motion scales. This distinction matters because representation quality and time discretization are separate design problems.

## 5. What JEPA changes

Joint Embedding Predictive Architectures learn by predicting representations. The model encodes observed context into a latent state and predicts the latent representation of another part of the data or a future observation. The target lives in feature space, so the learning signal asks the model to preserve information that helps prediction.

A simplified version looks like

\[
x_t
\xrightarrow{E}
z_t,
\]

\[
z_t
\xrightarrow{P}
\hat{z}_{t+\Delta},
\]

\[
x_{t+\Delta}
\xrightarrow{E_{\text{target}}}
z_{t+\Delta},
\]

followed by a loss that makes \(\hat{z}_{t+\Delta}\) match \(z_{t+\Delta}\).

This objective gives the representation freedom to compress visual details that contribute little to prediction. Stable object identity, motion, local geometry, and temporal relations can become especially valuable because they help connect one observation to another. V-JEPA 2 demonstrates the larger idea at scale. It learns from more than one million hours of video and image data, then post trains an action conditioned latent world model using less than 62 hours of unlabeled robot video for image goal planning on Franka arms. [^vjepa2]

JEPA still needs the right inductive bias for robotics. A representation that becomes too semantic can hide small pose or contact changes that matter for dexterous manipulation. The goal is a predictive state with enough invariance to ignore irrelevant appearance variation and enough spatial precision to preserve control relevant change. Dense patch level JEPA representations are attractive because they retain local spatial organization while benefiting from predictive pretraining.

## 6. Replacing the encoder changes the language of the world model

A pretrained video backbone has learned dynamics in a particular latent coordinate system. If it was trained on \(z^{\text{VAE}}\), its learned transition function has the form

\[
F_{\text{video}}
\left(
z_t^{\text{VAE}}
\right)
\rightarrow
z_{t+1}^{\text{VAE}}.
\]

A JEPA encoder produces a different representation,

\[
z_t^{\text{JEPA}}
=
E_{\text{JEPA}}(x_t).
\]

The two latent spaces can have different dimensions, token layouts, spatial organization, statistics, and semantic content. Matching tensor shape alone gives no reason for a pretrained VAE latent dynamics model to understand JEPA features.

Replacing the encoder therefore creates a new interface problem. The model needs a predictor trained to operate in the JEPA representation space, or an alignment module that translates JEPA features into a space understood by the rest of the architecture. In practice, the strongest designs treat the representation change as a redesign of the latent world model.

This is the key conceptual shift. Changing from VAE to JEPA changes the definition of state. Once the state changes, the prediction target, model interface, transition loss, and route from world supervision to action generation all need to agree with that new state.

## 7. How JEPA is connected to a WAM in JEPA-WAM

The August 2026 paper *JEPA-WAM: Learning Vision-Language-Action Policies with Joint-Embedding World Modeling* gives a concrete implementation of this idea. It builds the latent WAM directly inside a pretrained V-JEPA 2.1 representation space and couples transition prediction with action generation through a shared predictor. [^jepawam]

### Step 1: encode the current observation with V-JEPA

For each camera view \(v\), the frozen V-JEPA encoder \(E_J\) extracts dense patch features. The current visual state is

\[
Z_t
=
\operatorname{Concat}_{v\in V}
E_J(O_t^v).
\]

The token ordering preserves camera identity and patch level spatial structure. This gives the model a current world state with explicit local organization. [^jepawam]

### Step 2: construct a transition target in the same JEPA space

During training, JEPA-WAM also takes an observation collected \(\delta\) steps later. For each camera, it stacks the current and future observation along the temporal dimension and encodes them jointly:

\[
Y_{t,t+\delta}
=
\operatorname{Concat}_{v\in V}
\operatorname{sg}
\left[
E_J
\left(
\operatorname{Stack}_{\mathrm{time}}
(O_t^v,O_{t+\delta}^v)
\right)
\right].
\]

The operator \(\operatorname{sg}\) means stop gradient. The target captures the relation between current and future observations in V-JEPA space. Because the representation remains dense across patches, the supervision can preserve localized changes in objects and spatial relations. [^jepawam]

This target is especially important conceptually. The model learns a representation of transition structure. Its training target lives in a feature space that was learned for predictive video representation.

### Step 3: use a shared predictor for world learning and action conditioning

A lightweight visual projector maps \(Z_t\) into the input space of a shared predictor. JEPA-WAM instantiates that predictor with Qwen2.5 0.5B. The projected visual features, language instruction \(\ell\), and dedicated action placeholder tokens are processed together:

\[
(Q_t^{\mathrm{wm}}, C_t)
=
F_\theta
\left(
P_{\mathrm{vis}}(Z_t),
\ell,
P_{\mathrm{act}}
\right).
\]

The hidden states \(Q_t^{\mathrm{wm}}\) support latent transition prediction. The representations \(C_t\) condition the action generator. Both emerge from the same predictor, which means temporal supervision directly shapes the backbone that produces action relevant features. [^jepawam]

A prediction head maps the world modeling states back into V-JEPA space:

\[
\hat{Y}_{t,t+\delta}
=
G_\phi
\left(
Q_t^{\mathrm{wm}}
\right).
\]

The world loss compares \(\hat{Y}_{t,t+\delta}\) with the dense target \(Y_{t,t+\delta}\) using patch level cosine distance. This gives the shared predictor localized temporal supervision.

### Step 4: let the action expert generate the control trajectory

The action representation \(C_t\) is passed to a DiT based action expert together with the robot proprioceptive state. The action module uses conditional flow matching to generate an action chunk. Training combines the action loss with the world modeling loss:

\[
\mathcal{L}
=
\mathcal{L}_{\mathrm{act}}
+
\lambda_{\mathrm{wm}}
\mathcal{L}_{\mathrm{wm}}.
\]

Both losses influence the shared predictor. World learning therefore shapes the features that later support action generation. At deployment, JEPA-WAM removes the target branch and transition prediction head and keeps the pathway needed for action generation. [^jepawam]

The complete data flow is easy to summarize:

```text
current images
    |
frozen V-JEPA
    |
dense JEPA tokens
    |
visual projector
    |
shared predictor  <-----  language instruction
   / \
  /   \
transition states   action states
  |                 |
prediction head     DiT action expert
  |                 |
JEPA transition     action chunk
target loss
```

During training, future observations provide a representation learning signal. During deployment, the policy uses the representation shaped by that signal to act efficiently.

## 8. Why this connects directly to Fast-WAM

Fast-WAM and JEPA-WAM approach the same underlying question from different directions. Fast-WAM asks how much test time future imagination contributes after video based world learning has already shaped the model. JEPA-WAM asks what kind of latent transition target can shape the action backbone directly. Both place increasing importance on representation learning during training. [^fastwam] [^jepawam]

This suggests a broader interpretation of WAMs. A WAM can use future prediction as a training mechanism for building a better control state. Deployment can then use that state without running a full video generation process. The world model becomes useful because it teaches the policy how scenes evolve under action.

This view also explains why replacing a VAE with JEPA can matter even when the robot never explicitly predicts a future frame at test time. The encoder defines what information enters the control backbone. The predictive objective determines how that information is organized. The action loss then learns how to turn the resulting state into control.

## 9. What a strong robot world representation should preserve

The discussion leads to a more precise target for future WAM research. A useful robot state should preserve task relevant semantics, local geometry, object pose, motion, contact, and proprioceptive context. It should organize common physical transformations in a predictable way. It should also support transitions across the temporal scales that appear during training and deployment.

For simple tabletop manipulation, a semantic and spatial latent may already capture much of the required state. Dexterous manipulation raises the resolution requirement. Millimeter scale fingertip motion, small changes in object orientation, contact switches, and friction dependent behavior can change the correct action. A representation that compresses these differences too aggressively can lose exactly the variables that the controller needs.

This creates a promising design direction in which JEPA style predictive features are combined with stronger geometric and embodied state signals. One possible state can be written schematically as

\[
z_t
=
[
z_t^{\text{predictive}},
z_t^{\text{geometry}},
z_t^{\text{motion}},
s_t^{\text{proprio}}
].
\]

A world model would then learn

\[
F(z_t,a_t,\Delta t)
\rightarrow
z_{t+\Delta t},
\]

while the policy learns

\[
\pi(z_t,\ell)
\rightarrow
a_{t:t+H}.
\]

This formulation turns the central WAM question into a representation question with clear experimental tests. Different encoders can be compared under the same action head and training data. Temporal stride can be varied independently. Geometry preserving and appearance robust properties can be measured separately. Action performance can then reveal which parts of the latent state actually support control.

## 10. The main takeaway

VAE based latents became common in WAMs because many WAMs inherited pretrained video generation systems. That inheritance supplied a mature latent space and a powerful dynamics backbone. The same history also imported a representation objective centered on visual reconstruction and generation.

JEPA opens a different route. It builds a predictive representation space and allows a WAM to learn transitions directly inside that space. JEPA-WAM shows one concrete architecture in which a frozen V-JEPA encoder defines the visual state, a shared predictor learns dense latent transitions, and an action expert uses representations from the same backbone. Fast-WAM independently strengthens the case that training time world modeling can matter even when explicit future generation disappears during deployment. [^fastwam] [^jepawam]

The resulting research question is broader than a choice between two encoders. The important question is which latent state makes physical change easiest to predict and useful action easiest to generate. That framing provides a clean way to evaluate VAE latents, JEPA features, geometric representations, motion representations, and future hybrid systems under one common goal.

## References and version notes

[^vae]: Diederik P. Kingma and Max Welling. *Auto-Encoding Variational Bayes*. arXiv:1312.6114. First submitted December 2013 and published at ICLR 2014. Supports the canonical variational latent model and reparameterization formulation.

[^vjepa2]: Mido Assran et al. *V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning*. arXiv:2506.09985. First submitted June 11, 2025. Supports the use of predictive video representations and the V-JEPA 2-AC robot world model trained with less than 62 hours of unlabeled robot video.

[^fastwam]: Tianyuan Yuan, Zibin Dong, Yicheng Liu, and Hang Zhao. *Fast-WAM: Do World Action Models Need Test-time Future Imagination?* arXiv:2603.16666v2. Revised March 23, 2026. Supports the controlled comparison between video co training and test time future generation, including the reported 190 ms latency.

[^jepawam]: Yihan Lin et al. *JEPA-WAM: Learning Vision-Language-Action Policies with Joint-Embedding World Modeling*. arXiv:2608.09381. First submitted August 10, 2026. Supports the frozen V-JEPA 2.1 representation space, dense joint current future target, shared Qwen2.5 0.5B predictor, DiT action expert, joint loss, and removal of the transition branch during deployment.

[^openwam]: Yuran Wang et al. *OpenWAM: An Open, Modular Exploration Towards Systematic World-Action Model Pretraining*. arXiv:2609.07398. First submitted September 7, 2026. Supports the modular view that separates representation, backbone, information flow, inference procedure, and training data in WAM design.
