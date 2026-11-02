# Berges Homebrew tap

```
brew install bergesinstitute/tap/berges
```

`berges` is Berges AI as an agent in your terminal, on macOS and Linux. It is a small wrapper around [goose](https://github.com/aaif-goose/goose) (Apache 2.0), which Homebrew installs as a dependency, unmodified. The wrapper signs the computer in to Berges AI, points goose at the Berges AI API with its own settings folder, and shows the chatbot on start.

Help: https://berges.ai/help/use-berges-ai-in-your-terminal

## Layout

- `berges/bin/berges`: the wrapper (bash 3.2 compatible, needs `jq`).
- `berges/sprites/`: one 16×16 sprite per chatbot, named by chatbot id. A palette line is a key character and a hex colour; `.` is transparent.
- `Formula/berges.rb`: the formula.

## Release

1. Bump `VERSION` in `berges/bin/berges`.
2. Tag `berges-vX.Y.Z` and push the tag.
3. In the formula, set `url` to that tag's tarball and `sha256` to `curl -sL <url> | shasum -a 256`. Push.
