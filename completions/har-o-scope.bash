# bash completion for har-o-scope
# Install: source completions/har-o-scope.bash
# Or copy to /etc/bash_completion.d/har-o-scope

_har_o_scope() {
    local cur prev commands analyze_opts diff_opts sanitize_opts validate_opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    commands="analyze diff sanitize validate help"
    analyze_opts="--format --sarif --ci --baseline --threshold --verbose --rules --demo --no-color --help"
    diff_opts="--format --no-color --help"
    sanitize_opts="--output --mode --help"
    validate_opts="--rules --help"

    case "${COMP_WORDS[1]}" in
        analyze)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=( $(compgen -W "$analyze_opts" -- "$cur") )
            elif [[ "$prev" == "--format" ]]; then
                COMPREPLY=( $(compgen -W "text json markdown" -- "$cur") )
            elif [[ "$prev" == "--mode" ]]; then
                COMPREPLY=( $(compgen -W "aggressive selective" -- "$cur") )
            else
                COMPREPLY=( $(compgen -f -X '!*.har' -- "$cur") )
            fi
            ;;
        diff)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=( $(compgen -W "$diff_opts" -- "$cur") )
            elif [[ "$prev" == "--format" ]]; then
                COMPREPLY=( $(compgen -W "text json markdown" -- "$cur") )
            else
                COMPREPLY=( $(compgen -f -X '!*.har' -- "$cur") )
            fi
            ;;
        sanitize)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=( $(compgen -W "$sanitize_opts" -- "$cur") )
            elif [[ "$prev" == "--mode" ]]; then
                COMPREPLY=( $(compgen -W "aggressive selective" -- "$cur") )
            else
                COMPREPLY=( $(compgen -f -X '!*.har' -- "$cur") )
            fi
            ;;
        validate)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=( $(compgen -W "$validate_opts" -- "$cur") )
            else
                COMPREPLY=( $(compgen -f -X '!*.har' -X '!*.yaml' -X '!*.yml' -- "$cur") )
            fi
            ;;
        *)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=( $(compgen -W "--version --help" -- "$cur") )
            else
                COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
            fi
            ;;
    esac
}

complete -F _har_o_scope har-o-scope
