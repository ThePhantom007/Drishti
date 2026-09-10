classdef ReduceMeanLayer1023 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end


    methods(Static, Hidden)
        % Specify the path to the class that will be used for codegen
        function name = matlabCodegenRedirect(~)
            name = 'severity_net.coder.ReduceMeanLayer1023';
        end
    end


    methods
        function this = ReduceMeanLayer1023(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_5_83'};
        end

        function [x_blocks_blocks_5_83] = predict(this, x_blocks_blocks_5_77)
            if isdlarray(x_blocks_blocks_5_77)
                x_blocks_blocks_5_77 = stripdims(x_blocks_blocks_5_77);
            end
            x_blocks_blocks_5_77NumDims = 4;
            x_blocks_blocks_5_77 = severity_net.ops.permuteInputVar(x_blocks_blocks_5_77, [4 3 1 2], 4);

            [x_blocks_blocks_5_83, x_blocks_blocks_5_83NumDims] = ReduceMeanGraph1069(this, x_blocks_blocks_5_77, x_blocks_blocks_5_77NumDims, false);
            x_blocks_blocks_5_83 = severity_net.ops.permuteOutputVar(x_blocks_blocks_5_83, [3 4 2 1], 4);

            x_blocks_blocks_5_83 = dlarray(single(x_blocks_blocks_5_83), 'SSCB');
        end

        function [x_blocks_blocks_5_83] = forward(this, x_blocks_blocks_5_77)
            if isdlarray(x_blocks_blocks_5_77)
                x_blocks_blocks_5_77 = stripdims(x_blocks_blocks_5_77);
            end
            x_blocks_blocks_5_77NumDims = 4;
            x_blocks_blocks_5_77 = severity_net.ops.permuteInputVar(x_blocks_blocks_5_77, [4 3 1 2], 4);

            [x_blocks_blocks_5_83, x_blocks_blocks_5_83NumDims] = ReduceMeanGraph1069(this, x_blocks_blocks_5_77, x_blocks_blocks_5_77NumDims, true);
            x_blocks_blocks_5_83 = severity_net.ops.permuteOutputVar(x_blocks_blocks_5_83, [3 4 2 1], 4);

            x_blocks_blocks_5_83 = dlarray(single(x_blocks_blocks_5_83), 'SSCB');
        end

        function [x_blocks_blocks_5_83, x_blocks_blocks_5_83NumDims1071] = ReduceMeanGraph1069(this, x_blocks_blocks_5_77, x_blocks_blocks_5_77NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1070, x_blocks_blocks_5_77NumDims);
            xMean = mean(x_blocks_blocks_5_77, dims);
            x_blocks_blocks_5_83 = xMean;
            x_blocks_blocks_5_83NumDims = x_blocks_blocks_5_77NumDims;

            % Set graph output arguments
            x_blocks_blocks_5_83NumDims1071 = x_blocks_blocks_5_83NumDims;

        end

    end

end